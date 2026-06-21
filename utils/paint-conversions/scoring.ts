export type EdgeForRanking = {
  connection_type: string
  confidence_score: number | null
  distance_delta_e: number | null
  source_id: string | null
  is_active?: boolean | null
  needs_review?: boolean | null
}

export type RankingScores = {
  official_score: number
  hex_score: number
  manual_score: number
  penalty_score: number
  overall_score: number
  best_connection_type: string | null
  source_count: number
  min_delta_e: number | null
  avg_delta_e: number | null
  explanation: string
  is_hidden: boolean
  needs_review: boolean
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0

  return Math.max(0, Math.min(1, value))
}

function maxConfidence(edges: EdgeForRanking[], connectionTypes: Set<string>) {
  return edges.reduce((score, edge) => {
    if (!connectionTypes.has(edge.connection_type)) return score

    return Math.max(score, edge.confidence_score ?? 0)
  }, 0)
}

function bestEdge(edges: EdgeForRanking[]) {
  return [...edges].sort(
    (a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
  )[0]
}

export function calculateRankingScores(edges: EdgeForRanking[]): RankingScores {
  const activeEdges = edges.filter((edge) => edge.is_active !== false)
  const hasNotRecommended = activeEdges.some(
    (edge) => edge.connection_type === 'not_recommended'
  )
  const reviewEdgeCount = activeEdges.filter((edge) => edge.needs_review).length
  const sourceIds = new Set(
    activeEdges.map((edge) => edge.source_id).filter(Boolean) as string[]
  )
  const deltaEs = activeEdges
    .map((edge) => edge.distance_delta_e)
    .filter((value): value is number => typeof value === 'number')

  const official_score = maxConfidence(
    activeEdges,
    new Set(['official_conversion', 'official_equivalent'])
  )
  const hex_score = maxConfidence(activeEdges, new Set(['hex_similarity']))
  const manual_score = maxConfidence(
    activeEdges,
    new Set(['manual_equivalent', 'admin_curated', 'community_suggestion'])
  )
  const penalty_score = hasNotRecommended ? 1 : reviewEdgeCount > 0 ? 0.15 : 0
  const overall_score = clamp01(
    official_score * 0.5 + hex_score * 0.3 + manual_score * 0.2 - penalty_score
  )
  const best = bestEdge(activeEdges)
  const min_delta_e = deltaEs.length > 0 ? Math.min(...deltaEs) : null
  const avg_delta_e =
    deltaEs.length > 0
      ? deltaEs.reduce((sum, value) => sum + value, 0) / deltaEs.length
      : null

  const explanationParts = []

  if (official_score > 0) explanationParts.push('official chart match')
  if (hex_score > 0) explanationParts.push('close LAB color match')
  if (manual_score > 0) explanationParts.push('curated equivalent')
  if (hasNotRecommended) explanationParts.push('marked not recommended')

  return {
    official_score,
    hex_score,
    manual_score,
    penalty_score,
    overall_score,
    best_connection_type: best?.connection_type ?? null,
    source_count: sourceIds.size,
    min_delta_e,
    avg_delta_e,
    explanation: explanationParts.join(', ') || 'similar paint candidate',
    is_hidden: hasNotRecommended,
    needs_review: hasNotRecommended || reviewEdgeCount > 0 || overall_score < 0.35,
  }
}
