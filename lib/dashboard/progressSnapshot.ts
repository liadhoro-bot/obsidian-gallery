import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardProgressSnapshot = {
  achievementMetrics: Record<string, number>
  paintingDays: string[]
  metadata: Record<string, unknown>
}

function numberRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null
    result[key] = item
  }
  return result
}

export async function getDashboardProgressSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardProgressSnapshot | null> {
  const { data, error } = await supabase
    .from('dashboard_progress_snapshots')
    .select('achievement_metrics, painting_days, metadata')
    .eq('user_id', userId)

  if (error || !data?.length) return null
  const row = data[0] as {
    achievement_metrics?: unknown
    painting_days?: unknown
    metadata?: unknown
  }
  const achievementMetrics = numberRecord(row.achievement_metrics)
  if (!achievementMetrics) return null

  return {
    achievementMetrics,
    paintingDays: Array.isArray(row.painting_days)
      ? row.painting_days.filter((day): day is string => typeof day === 'string')
      : [],
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {},
  }
}
