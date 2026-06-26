import { createClient } from '../../utils/supabase/server'
import type { DashboardMetadataItem } from './dashboard-metadata-cards'
import DashboardMetadataCards from './dashboard-metadata-cards'
import { getDashboardMetadataSummary } from './dashboard-data'

export default async function DashboardMetadataGrid({
  userId,
}: {
  userId?: string
}) {
  const supabase = await createClient()

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    resolvedUserId = user.id
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [totalUnitsResult, recentUnitsResult, ownedColorsResult] =
    await Promise.all([
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', resolvedUserId),

      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', resolvedUserId)
        .gte('created_at', thirtyDaysAgo.toISOString()),

      supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id', { count: 'exact', head: true })
        .eq('user_id', resolvedUserId)
        .eq('is_owned', true),
    ])
  const metadataSummary = await getDashboardMetadataSummary(resolvedUserId)

  const items: DashboardMetadataItem[] = [
    {
      id: 'total-units',
      label: 'Total Units',
      value: String(metadataSummary.totalUnits ?? totalUnitsResult.count ?? 0),
      accent: 'text-white',
    },
    {
      id: 'added-last-30-days',
      label: 'Added Last 30 Days',
      value: `+${metadataSummary.recentUnits ?? recentUnitsResult.count ?? 0}`,
      accent: 'text-orange-400',
    },
    {
      id: 'time-logged',
      label: 'Time Logged',
      value: metadataSummary.timeLogged,
      accent: 'text-white',
    },
    {
      id: 'average-session-length',
      label: 'Avg Session Length',
      value: metadataSummary.averageSessionLength,
      accent: 'text-white',
    },
    {
      id: 'weekly-sessions',
      label: 'Weekly Sessions',
      value: metadataSummary.weeklySessions,
      accent: 'text-orange-400',
    },
    {
      id: 'colors-in-vault',
      label: 'Colors in Vault',
      value: String(metadataSummary.ownedColors ?? ownedColorsResult.count ?? 0),
      accent: 'text-white',
    },
    {
      id: 'since-last-session',
      label: 'Since Last Session',
      value: metadataSummary.timeSinceLastSession,
      accent: 'text-white',
    },
    {
      id: 'paint-streak',
      label: 'Paint Streak',
      value: metadataSummary.paintStreak,
      accent: 'text-orange-400',
    },
  ]

  return <DashboardMetadataCards items={items} />
}
