import 'server-only'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'

export const INBOX_FILTERS = [
  { id: 'new', label: 'To review' },
  { id: 'other', label: 'Low match' },
  { id: 'drafted', label: 'Drafted' },
  { id: 'dismissed', label: 'Dismissed' },
] as const

export type InboxFilter = (typeof INBOX_FILTERS)[number]['id']

export function parseInboxFilter(value: unknown): InboxFilter {
  return INBOX_FILTERS.find((filter) => filter.id === value)?.id ?? 'new'
}

export type InboxItem = {
  id: string
  title: string
  url: string
  publishedAt: string | null
  discoveredAt: string
  excerpt: string | null
  relevance: 'relevant' | 'maybe' | 'irrelevant'
  reasons: string[]
  state: 'new' | 'dismissed' | 'drafted'
  sourceName: string
  alsoReportedBy: string[]
  articleId: string | null
}

type ItemRow = {
  id: string
  title: string
  canonical_url: string
  published_at: string | null
  discovered_at: string
  evidence_excerpt: string | null
  relevance: InboxItem['relevance']
  relevance_reasons: string[]
  state: InboxItem['state']
  cluster_id: string | null
  news_sources: { name: string } | null
}

const INBOX_LIMIT = 100

// Admin-only: callers must have passed requireNewsroomAccess first.
export async function getInboxItems(filter: InboxFilter): Promise<{ items: InboxItem[]; failed: boolean }> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from('news_source_items')
    .select(
      'id, title, canonical_url, published_at, discovered_at, evidence_excerpt, relevance, relevance_reasons, state, cluster_id, news_sources(name)'
    )
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('discovered_at', { ascending: false })
    .limit(INBOX_LIMIT)

  if (filter === 'new') query = query.eq('state', 'new').in('relevance', ['relevant', 'maybe'])
  else if (filter === 'other') query = query.eq('state', 'new').eq('relevance', 'irrelevant')
  else query = query.eq('state', filter)

  const { data, error } = await query
  if (error) {
    console.error('Failed to load the news inbox', error)
    return { items: [], failed: true }
  }
  const rows = data as unknown as ItemRow[]

  // Other sources reporting the same story, and drafts already started.
  const clusterIds = [...new Set(rows.map((row) => row.cluster_id).filter((id): id is string => Boolean(id)))]
  const [clusterMembers, links] = await Promise.all([
    clusterIds.length > 0
      ? supabase.from('news_source_items').select('id, cluster_id, news_sources(name)').in('cluster_id', clusterIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('news_article_sources')
      .select('source_item_id, article_id')
      .in('source_item_id', rows.map((row) => row.id)),
  ])

  const membersByCluster = new Map<string, Array<{ id: string; name: string }>>()
  for (const member of (clusterMembers.data ?? []) as unknown as Array<{
    id: string
    cluster_id: string
    news_sources: { name: string } | null
  }>) {
    const list = membersByCluster.get(member.cluster_id) ?? []
    list.push({ id: member.id, name: member.news_sources?.name ?? 'Unknown source' })
    membersByCluster.set(member.cluster_id, list)
  }
  const articleByItem = new Map(
    ((links.data ?? []) as Array<{ source_item_id: string; article_id: string }>).map((link) => [
      link.source_item_id,
      link.article_id,
    ])
  )

  return {
    failed: false,
    items: rows.map((row) => {
      const sourceName = row.news_sources?.name ?? 'Unknown source'
      const others = (row.cluster_id ? membersByCluster.get(row.cluster_id) ?? [] : [])
        .filter((member) => member.id !== row.id)
        .map((member) => member.name)
      return {
        id: row.id,
        title: row.title,
        url: row.canonical_url,
        publishedAt: row.published_at,
        discoveredAt: row.discovered_at,
        excerpt: row.evidence_excerpt,
        relevance: row.relevance,
        reasons: row.relevance_reasons,
        state: row.state,
        sourceName,
        alsoReportedBy: [...new Set(others)],
        articleId: articleByItem.get(row.id) ?? null,
      }
    }),
  }
}

export type NewsSourceRun = {
  id: string
  trigger: 'schedule' | 'manual'
  status: 'running' | 'succeeded' | 'failed'
  startedAt: string
  itemsNew: number
  itemsDuplicate: number
  error: string | null
}

export type NewsSourceSummary = {
  id: string
  name: string
  domain: string
  coverage: string | null
  discoveryMethod: string
  listingUrl: string
  enabled: boolean
  pollIntervalMinutes: number
  collectionPermission: string
  permissionNotes: string | null
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  consecutiveFailures: number
  failureCount: number
  lastError: string | null
  recentRuns: NewsSourceRun[]
}

export async function getNewsSources(): Promise<NewsSourceSummary[]> {
  const supabase = createServiceRoleClient()
  const [sources, runs] = await Promise.all([
    supabase
      .from('news_sources')
      .select(
        'id, name, domain, coverage, discovery_method, listing_url, enabled, poll_interval_minutes, collection_permission, permission_notes, last_attempt_at, last_success_at, consecutive_failures, failure_count, last_error'
      )
      .order('enabled', { ascending: false })
      .order('name'),
    supabase
      .from('news_ingestion_runs')
      .select('id, source_id, trigger, status, started_at, items_new, items_duplicate, error')
      .order('started_at', { ascending: false })
      .limit(80),
  ])

  if (sources.error) {
    console.error('Failed to load news sources', sources.error)
    return []
  }

  const runsBySource = new Map<string, NewsSourceRun[]>()
  for (const run of runs.data ?? []) {
    const list = runsBySource.get(run.source_id) ?? []
    if (list.length < 5) {
      list.push({
        id: run.id,
        trigger: run.trigger,
        status: run.status,
        startedAt: run.started_at,
        itemsNew: run.items_new,
        itemsDuplicate: run.items_duplicate,
        error: run.error,
      })
    }
    runsBySource.set(run.source_id, list)
  }

  return sources.data.map((source) => ({
    id: source.id,
    name: source.name,
    domain: source.domain,
    coverage: source.coverage,
    discoveryMethod: source.discovery_method,
    listingUrl: source.listing_url,
    enabled: source.enabled,
    pollIntervalMinutes: source.poll_interval_minutes,
    collectionPermission: source.collection_permission,
    permissionNotes: source.permission_notes,
    lastAttemptAt: source.last_attempt_at,
    lastSuccessAt: source.last_success_at,
    consecutiveFailures: source.consecutive_failures,
    failureCount: source.failure_count,
    lastError: source.last_error,
    recentRuns: runsBySource.get(source.id) ?? [],
  }))
}
