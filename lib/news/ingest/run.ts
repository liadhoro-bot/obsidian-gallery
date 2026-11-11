import 'server-only'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { classifyRelevance, contentFingerprint, isSameStory, titleKey, titleTokens } from './classify'
import {
  collectCandidates,
  createSourceContext,
  enrichCandidate,
  type Candidate,
  type DiscoveryMethod,
  type NewsSourceConfig,
  type SourceContext,
} from './collect'
import { describeIngestError, isSourceDue, runIsolated } from './schedule'

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
  poll_interval_minutes: number
  rate_limit_ms: number
  max_items_per_run: number
  lookback_days: number
  last_attempt_at: string | null
  consecutive_failures: number
  failure_count: number
}

const SOURCE_COLUMNS =
  'id, slug, name, domain, discovery_method, listing_url, sitemap_child_pattern, url_include_pattern, poll_interval_minutes, rate_limit_ms, max_items_per_run, lookback_days, last_attempt_at, consecutive_failures, failure_count'

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

    const { relevance, reasons } = classifyRelevance(candidate.title, candidate.excerpt)
    const { data, error } = await supabase
      .from('news_source_items')
      .insert({
        source_id: source.id,
        external_id: candidate.externalId,
        canonical_url: candidate.url,
        title: candidate.title,
        published_at: candidate.publishedAt?.toISOString() ?? null,
        evidence_excerpt: candidate.excerpt || null,
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
    const context = createSourceContext(config, { fetchImpl })
    const { candidates, skipped } = await collectCandidates(config, context)
    const counts = await storeCandidates(supabase, config, candidates, context, run.id, deadline)
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
  const sources = (data as SourceRow[]).filter((row) => options.trigger === 'manual' || isSourceDue(row, now))

  return runIsolated(
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
}
