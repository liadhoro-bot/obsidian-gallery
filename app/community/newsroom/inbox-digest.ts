// The daily digest: pure, so it can be tested without a database.

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
  // Tip-off sources: headline and link only.
  isTip: boolean
  thumbnailUrl: string | null
  videoId: string | null
  alsoReportedBy: string[]
  articleId: string | null
}

export type SourceJoin = { name: string; content_reuse: string } | null

export type ClusterMember = {
  id: string
  cluster_id: string
  evidence_excerpt: string | null
  video_id: string | null
  thumbnail_url: string | null
  news_sources: SourceJoin
}

// The digest covers what was found in roughly the last day, one card per story.
export const DIGEST_WINDOW_HOURS = 30
export const DIGEST_SIZE = 8

export function isTipSource(source: SourceJoin) {
  return source?.content_reuse === 'link_only'
}

function digestScore(item: InboxItem) {
  return (
    (item.relevance === 'relevant' ? 4 : 0) +
    (item.thumbnailUrl ? 2 : 0) +
    (item.isTip ? 0 : 1) +
    Math.min(item.alsoReportedBy.length, 3)
  )
}

// One card per story: the best report leads, borrowing a picture or the
// official description from other reports of the same story.
export function buildDigest(items: InboxItem[], members: Map<string, ClusterMember[]>, clusterOf: Map<string, string | null>) {
  const byStory = new Map<string, InboxItem>()
  for (const item of items) {
    const clusterId = clusterOf.get(item.id)
    const key = clusterId ?? item.id
    const current = byStory.get(key)
    const leader = !current || digestScore(item) > digestScore(current) ? item : current
    const cluster = clusterId ? members.get(clusterId) ?? [] : []
    const withVideo = cluster.find((member) => member.video_id && member.thumbnail_url)
    const withExcerpt = cluster.find((member) => member.evidence_excerpt && !isTipSource(member.news_sources))
    byStory.set(key, {
      ...leader,
      excerpt: leader.excerpt ?? withExcerpt?.evidence_excerpt ?? null,
      thumbnailUrl: leader.thumbnailUrl ?? withVideo?.thumbnail_url ?? null,
      videoId: leader.videoId ?? withVideo?.video_id ?? null,
    })
  }
  return [...byStory.values()]
    .sort(
      (a, b) =>
        digestScore(b) - digestScore(a) ||
        (b.publishedAt ?? b.discoveredAt).localeCompare(a.publishedAt ?? a.discoveredAt)
    )
    .slice(0, DIGEST_SIZE)
}

