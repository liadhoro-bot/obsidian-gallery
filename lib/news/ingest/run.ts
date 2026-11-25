import 'server-only'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { classifyRelevance, contentFingerprint, isSameStory, titleKey, titleTokens } from './classify'
import {
  collectCandidates,
  createSourceContext,
  enrichCandidate,
  type Candidate,
  type ContentReuse,
  type DiscoveryMethod,
  type NewsSourceConfig,
  type SourceContext,
} from './collect'
import { searchOfficialVideo } from './match-video'
import { describeIngestError, isSourceDue, runIsolated } from './schedule'
import { detectGameSystem } from '../game-systems'

type Supabase = ReturnType<typeof createServiceRoleClient>

type SourceRow = {
  id: string
  slug: string
  name: string
  domain: string
  discovery_method: DiscoveryMethod
  listing_url: string
  sitemap_child_pattern: string | null
  url_include_pattern: string | null
  youtube_channel_id: string | null
  content_reuse: ContentReuse
  poll_interval_minutes: number
  rate_limit_ms: number
  max_items_per_run: number
  lookback_days: number
  last_attempt_at: string | null
  consecutive_failures: number
  failure_count: number
}

const SOURCE_COLUMNS =
  'id, slug, name, domain, discovery_method, listing_url, sitemap_child_pattern, url_include_pattern, youtube_channel_id, content_reuse, poll_interval_minutes, rate_limit_ms, max_items_per_run, lookback_days, last_attempt_at, consecutive_failures, failure_count'

// Pages fetched per run to fill in sitemap/listing entries. The rest wait for
// the next run, which keeps each run short.
const MAX_ENRICH_PER_RUN = 8
const CLUSTER_WINDOW_DAYS = 14
const DEADLINE_MARGIN_MS = 4_000

export type IngestTrigger = 'schedule' | 'manual'

export type SourceRunResult = {
  sourceId: string
  slug: string
  status: 'succeeded' | 'failed' | 'skipped'
  itemsSeen: number
  itemsNew: number
  itemsDuplicate: number
  itemsSkipped: number
  error?: string
}

function toConfig(row: SourceRow): NewsSourceConfig {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    domain: row.domain,
    discoveryMethod: row.discovery_method,
    listingUrl: row.listing_url,
    sitemapChildPattern: row.sitemap_child_pattern,
    urlIncludePattern: row.url_include_pattern,
    youtubeChannelId: row.youtube_channel_id,
    contentReuse: row.content_reuse,
    rateLimitMs: row.rate_limit_ms,
    maxItemsPerRun: row.max_items_per_run,
    lookbackDays: row.lookback_days,
  }
}

type ClusterRow = { id: string; title_key: string; item_count: number }

class ClusterIndex {
  private clusters: Array<ClusterRow & { tokens: string[] }> | null = null

  constructor(private readonly supabase: Supabase) {}

  private async load() {
    if (this.clusters) return this.clusters
    const since = new Date(Date.now() - CLUSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await this.supabase
      .from('news_story_clusters')
      .select('id, title_key, item_count')
      .gte('last_seen_at', since)
      .order('last_seen_at', { ascending: false })
      .limit(300)
    if (error) throw new Error(`Could not load story clusters: ${error.message}`)
    this.clusters = (data as ClusterRow[]).map((row) => ({ ...row, tokens: row.title_key.split(' ').filter(Boolean) }))
    return this.clusters
  }

  async assign(itemId: string, title: string) {
    const clusters = await this.load()
    const tokens = titleTokens(title)
    const now = new Date().toISOString()
    const match = clusters.find((cluster) => isSameStory(tokens, cluster.tokens))
    let clusterId: string

    if (match) {
      match.item_count += 1
      clusterId = match.id
      await this.supabase
        .from('news_story_clusters')
        .update({ item_count: match.item_count, last_seen_at: now })
        .eq('id', match.id)
    } else {
      const key = titleKey(title)
      const { data, error } = await this.supabase
        .from('news_story_clusters')
        .insert({ title, title_key: key, item_count: 1 })
        .select('id')
        .single()
      if (error || !data) throw new Error(`Could not create a story cluster: ${error?.message}`)
      clusterId = data.id
      clusters.unshift({ id: clusterId, title_key: key, item_count: 1, tokens })
    }

    await this.supabase.from('news_source_items').update({ cluster_id: clusterId }).eq('id', itemId)
  }
}

async function findKnownItems(supabase: Supabase, sourceId: string, candidates: Candidate[]) {
  if (candidates.length === 0) return { known: new Map<string, string>() }
  const [byExternalId, byUrl] = await Promise.all([
    supabase
      .from('news_source_items')
      .select('id, external_id, canonical_url')
      .eq('source_id', sourceId)
      .in('external_id', candidates.map((candidate) => candidate.externalId)),
    supabase
      .from('news_source_items')
      .select('id, external_id, canonical_url')
      .in('canonical_url', candidates.map((candidate) => candidate.url)),
  ])
  if (byExternalId.error || byUrl.error) {
    throw new Error(`Could not check for known items: ${(byExternalId.error ?? byUrl.error)?.message}`)
  }

  // Keyed by both external id and URL, pointing at the stored row's id.
  const known = new Map<string, string>()
  for (const row of [...(byExternalId.data ?? []), ...(byUrl.data ?? [])]) {
    known.set(`id:${row.external_id}`, row.id)
    known.set(`url:${row.canonical_url}`, row.id)
  }
  return { known }
}

async function storeCandidates(
  supabase: Supabase,
  source: NewsSourceConfig,
  candidates: Candidate[],
  context: SourceContext,
  runId: string,
  deadline: number
) {
  const counts = { new: 0, duplicate: 0, skipped: 0 }
  const { known } = await findKnownItems(supabase, source.id, candidates)
  const seenIds = new Set<string>()
  const clusters = new ClusterIndex(supabase)
  let enriched = 0

  for (const original of candidates) {
    const knownId = known.get(`id:${original.externalId}`) ?? known.get(`url:${original.url}`)
    if (knownId) {
      seenIds.add(knownId)
      counts.duplicate += 1
      // YouTube API data must be kept current: refresh what we hold.
      if (source.discoveryMethod === 'youtube') {
        await supabase
          .from('news_source_items')
          .update({
            title: original.title,
            evidence_excerpt: original.excerpt || null,
            thumbnail_url: original.thumbnailUrl ?? null,
          })
          .eq('id', knownId)
      }
      continue
    }

    let candidate: Candidate | null = original
    if (candidate.needsMetadata) {
      if (enriched >= MAX_ENRICH_PER_RUN || Date.now() > deadline - DEADLINE_MARGIN_MS) {
        // Left for the next run; it isn't stored, so it'll be found again.
        counts.skipped += 1
        continue
      }
      enriched += 1
      try {
        candidate = await enrichCandidate(source, candidate, context)
      } catch (error) {
        console.warn(`News ingest: could not read ${original.url}`, describeIngestError(error))
        candidate = null
      }
      if (!candidate) {
        counts.skipped += 1
        continue
      }
    }

    // Triage may read a tip's teaser, but only its headline and link are kept.
    const { relevance, reasons } = classifyRelevance(candidate.title, candidate.excerpt)
    const linkOnly = source.contentReuse === 'link_only'
    const { data, error } = await supabase
      .from('news_source_items')
      .insert({
        source_id: source.id,
        external_id: candidate.externalId,
        canonical_url: candidate.url,
        title: candidate.title,
        published_at: candidate.publishedAt?.toISOString() ?? null,
        evidence_excerpt: linkOnly ? null : candidate.excerpt || null,
        video_id: candidate.videoId ?? null,
        thumbnail_url: linkOnly ? null : (candidate.thumbnailUrl ?? null),
        content_fingerprint: contentFingerprint(candidate.title, candidate.publishedAt, candidate.url),
        relevance,
        relevance_reasons: reasons,
        first_run_id: runId,
      })
      .select('id')
      .single()

    if (error) {
      // A unique key matched: the same post under another id, URL or fingerprint.
      if (error.code === '23505') {
        counts.duplicate += 1
        continue
      }
      throw new Error(`Could not store an item: ${error.message}`)
    }

    counts.new += 1
    if (relevance !== 'irrelevant') await clusters.assign(data.id, candidate.title)
  }

  if (seenIds.size > 0) {
    await supabase
      .from('news_source_items')
      .update({ last_seen_at: new Date().toISOString() })
      .in('id', [...seenIds])
  }
  return counts
}

const YOUTUBE_DATA_MAX_AGE_DAYS = 30

// YouTube's API policies don't allow keeping its data for more than 30 days
// without refreshing it. Videos still in a channel's recent uploads are
// refreshed on every run; anything not seen for 30 days is deleted, or, if an
// article was started from it, reduced to its video id.
async function expireYouTubeData(supabase: Supabase, sourceId: string) {
  const cutoff = new Date(Date.now() - YOUTUBE_DATA_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error: deleteError } = await supabase
    .from('news_source_items')
    .delete()
    .eq('source_id', sourceId)
    .neq('state', 'drafted')
    .lt('last_seen_at', cutoff)
  if (deleteError) throw new Error(`Could not expire old YouTube items: ${deleteError.message}`)

  const { data: drafted, error } = await supabase
    .from('news_source_items')
    .select('id, video_id')
    .eq('source_id', sourceId)
    .eq('state', 'drafted')
    .lt('last_seen_at', cutoff)
    .not('title', 'like', 'YouTube video%')
  if (error) throw new Error(`Could not expire old YouTube items: ${error.message}`)
  for (const item of drafted ?? []) {
    await supabase
      .from('news_source_items')
      .update({ title: `YouTube video ${item.video_id ?? ''}`.trim(), evidence_excerpt: null, thumbnail_url: null })
      .eq('id', item.id)
  }
}

async function runSource(
  supabase: Supabase,
  row: SourceRow,
  trigger: IngestTrigger,
  deadline: number,
  fetchImpl?: typeof fetch
): Promise<SourceRunResult> {
  const base = { sourceId: row.id, slug: row.slug, itemsSeen: 0, itemsNew: 0, itemsDuplicate: 0, itemsSkipped: 0 }
  const startedAt = new Date().toISOString()

  // Claim the source so overlapping runs can't collect it twice at once.
  const claim = supabase.from('news_sources').update({ last_attempt_at: startedAt }).eq('id', row.id)
  const { data: claimed } = await (row.last_attempt_at
    ? claim.eq('last_attempt_at', row.last_attempt_at)
    : claim.is('last_attempt_at', null)
  ).select('id')
  if (!claimed?.length) return { ...base, status: 'skipped' }

  const { data: run, error: runError } = await supabase
    .from('news_ingestion_runs')
    .insert({ source_id: row.id, trigger, started_at: startedAt })
    .select('id')
    .single()
  if (runError || !run) throw new Error(`Could not record the run: ${runError?.message}`)

  try {
    const config = toConfig(row)
    const context = createSourceContext(config, {
      fetchImpl,
      youtubeApiKey: process.env.YOUTUBE_API_KEY?.trim() || null,
    })
    const { candidates, skipped } = await collectCandidates(config, context)
    const counts = await storeCandidates(supabase, config, candidates, context, run.id, deadline)
    if (config.discoveryMethod === 'youtube') await expireYouTubeData(supabase, row.id)
    const result = {
      ...base,
      status: 'succeeded' as const,
      itemsSeen: candidates.length,
      itemsNew: counts.new,
      itemsDuplicate: counts.duplicate,
      itemsSkipped: counts.skipped + skipped,
    }
    const finishedAt = new Date().toISOString()
    await supabase
      .from('news_ingestion_runs')
      .update({
        status: 'succeeded',
        finished_at: finishedAt,
        items_seen: result.itemsSeen,
        items_new: result.itemsNew,
        items_duplicate: result.itemsDuplicate,
        items_skipped: result.itemsSkipped,
      })
      .eq('id', run.id)
    await supabase
      .from('news_sources')
      .update({ last_success_at: finishedAt, consecutive_failures: 0, last_error: null, updated_at: finishedAt })
      .eq('id', row.id)
    return result
  } catch (error) {
    const message = describeIngestError(error)
    console.error(`News ingest failed for ${row.slug}:`, message)
    const finishedAt = new Date().toISOString()
    await supabase
      .from('news_ingestion_runs')
      .update({ status: 'failed', finished_at: finishedAt, error: message })
      .eq('id', run.id)
    await supabase
      .from('news_sources')
      .update({
        consecutive_failures: row.consecutive_failures + 1,
        failure_count: row.failure_count + 1,
        last_error: message,
        updated_at: finishedAt,
      })
      .eq('id', row.id)
    return { ...base, status: 'failed', error: message }
  }
}

// Collects from every enabled source that's due (or from one source on
// request). Sources run one after another, each isolated from the others,
// and nothing new starts once the time budget is nearly spent.
export async function runNewsIngestion(options: {
  trigger: IngestTrigger
  sourceId?: string
  budgetMs?: number
  fetchImpl?: typeof fetch
}): Promise<SourceRunResult[]> {
  const deadline = Date.now() + (options.budgetMs ?? 45_000)
  const supabase = createServiceRoleClient()
  let query = supabase.from('news_sources').select(SOURCE_COLUMNS).eq('enabled', true).order('last_attempt_at', {
    ascending: true,
    nullsFirst: true,
  })
  if (options.sourceId) query = query.eq('id', options.sourceId)

  const { data, error } = await query
  if (error) throw new Error(`Could not load news sources: ${error.message}`)

  const now = new Date()
  // Without an API key YouTube sources would only pile up failures and back
  // off, so scheduled runs leave them alone until the key is configured.
  const hasYouTubeKey = Boolean(process.env.YOUTUBE_API_KEY?.trim())
  const sources = (data as SourceRow[]).filter(
    (row) =>
      options.trigger === 'manual' ||
      (isSourceDue(row, now) && (hasYouTubeKey || row.discovery_method !== 'youtube'))
  )

  const results = await runIsolated<SourceRow, SourceRunResult>(
    sources,
    (row) => runSource(supabase, row, options.trigger, deadline, options.fetchImpl),
    (row, runError) => {
      const message = describeIngestError(runError)
      console.error(`News ingest crashed for ${row.slug}:`, message)
      return {
        sourceId: row.id,
        slug: row.slug,
        status: 'failed',
        itemsSeen: 0,
        itemsNew: 0,
        itemsDuplicate: 0,
        itemsSkipped: 0,
        error: message,
      }
    },
    () => Date.now() < deadline - DEADLINE_MARGIN_MS * 2
  )

  if (!options.sourceId) {
    try {
      const matched = await matchOfficialVideos(supabase, deadline, options.fetchImpl)
      if (matched > 0) console.info(`News ingest: matched ${matched} official video(s) to stories`)
    } catch (error) {
      console.error('News video matching failed:', describeIngestError(error))
    }
  }
  return results
}

const VIDEO_SEARCH_WINDOW_HOURS = 30
const MAX_VIDEO_SEARCHES_PER_RUN = 3
// Counts every story checked today, searched or not: at most 60 searches
// (6,000 of YouTube's 10,000 free daily units) plus the channel checks.
const MAX_VIDEO_CHECKS_PER_DAY = 60

type ClusterItemRow = { title: string; published_at: string | null; relevance: string; video_id: string | null }

// Gives new stories an official video: searches the maker's own channel for
// each recent story that has none, and files a match under that channel's
// source in the same story, where drafts and the digest pick it up. Each story
// is checked once (news_story_clusters.video_searched_at).
async function matchOfficialVideos(supabase: Supabase, deadline: number, fetchImpl?: typeof fetch) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim()
  if (!apiKey) return 0

  const since = new Date(Date.now() - VIDEO_SEARCH_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const { data: clusters, error } = await supabase
    .from('news_story_clusters')
    .select('id')
    .is('video_searched_at', null)
    .gte('first_seen_at', since)
    .order('first_seen_at', { ascending: false })
    .limit(12)
  if (error) {
    // Most likely the migration adding video_searched_at hasn't run yet.
    console.warn('News video matching skipped:', error.message)
    return 0
  }
  if (!clusters?.length) return 0

  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)
  const { count: checkedToday } = await supabase
    .from('news_story_clusters')
    .select('id', { count: 'exact', head: true })
    .gte('video_searched_at', dayStart.toISOString())
  let checksLeft = MAX_VIDEO_CHECKS_PER_DAY - (checkedToday ?? 0)

  const { data: channels } = await supabase
    .from('news_sources')
    .select('id, slug, youtube_channel_id')
    .eq('enabled', true)
    .eq('discovery_method', 'youtube')
  const channelBySlug = new Map(
    (channels ?? []).map((row) => [row.slug as string, row as { id: string; slug: string; youtube_channel_id: string | null }])
  )
  const context = createSourceContext({ domain: 'youtube.com', rateLimitMs: 0 }, { fetchImpl, youtubeApiKey: apiKey })

  let searches = 0
  let matched = 0
  for (const cluster of clusters) {
    if (checksLeft <= 0 || searches >= MAX_VIDEO_SEARCHES_PER_RUN || Date.now() > deadline - DEADLINE_MARGIN_MS) break
    checksLeft -= 1
    // Marked before searching, so a failing search isn't retried every run.
    await supabase
      .from('news_story_clusters')
      .update({ video_searched_at: new Date().toISOString() })
      .eq('id', cluster.id)

    const { data: itemData } = await supabase
      .from('news_source_items')
      .select('title, published_at, relevance, video_id')
      .eq('cluster_id', cluster.id)
    const items = (itemData ?? []) as ClusterItemRow[]
    const lead = items.find((item) => item.relevance === 'relevant')
    if (!lead || items.some((item) => item.video_id)) continue

    const system = detectGameSystem(...items.map((item) => item.title))
    const channel = system?.channelSlug ? channelBySlug.get(system.channelSlug) : undefined
    if (!channel?.youtube_channel_id) continue

    searches += 1
    let video: Candidate | null
    try {
      video = await searchOfficialVideo(
        context,
        channel.youtube_channel_id,
        lead.title,
        lead.published_at ? new Date(lead.published_at) : null
      )
    } catch (searchError) {
      console.warn(`News video search failed for "${lead.title}":`, describeIngestError(searchError))
      continue
    }
    if (!video) continue

    const { data: existing } = await supabase
      .from('news_source_items')
      .select('id')
      .eq('source_id', channel.id)
      .eq('external_id', video.externalId)
      .maybeSingle()
    if (existing) {
      await supabase.from('news_source_items').update({ cluster_id: cluster.id }).eq('id', existing.id)
      matched += 1
      continue
    }

    const { relevance, reasons } = classifyRelevance(video.title, video.excerpt)
    const { error: insertError } = await supabase.from('news_source_items').insert({
      source_id: channel.id,
      external_id: video.externalId,
      canonical_url: video.url,
      title: video.title,
      published_at: video.publishedAt?.toISOString() ?? null,
      evidence_excerpt: video.excerpt || null,
      video_id: video.videoId,
      thumbnail_url: video.thumbnailUrl,
      content_fingerprint: contentFingerprint(video.title, video.publishedAt, video.url),
      relevance: relevance === 'irrelevant' ? 'maybe' : relevance,
      relevance_reasons: ['matched to story', ...reasons],
      cluster_id: cluster.id,
    })
    if (insertError) {
      if (insertError.code !== '23505') console.warn('Could not store a matched video:', insertError.message)
      continue
    }
    matched += 1
  }
  return matched
}
