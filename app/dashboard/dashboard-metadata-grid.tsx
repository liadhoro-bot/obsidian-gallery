import { createClient } from '../../utils/supabase/server'

function formatDuration(totalSeconds: number) {
  const totalHours = Math.floor(totalSeconds / 3600)

  if (totalHours < 100) {
    return `${totalHours}h`
  }

  return `${totalHours}h`
}

export default async function DashboardMetadataGrid() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalUnitsResult,
    recentUnitsResult,
    ownedColorsResult,
    sessionsResult,
  ] = await Promise.all([
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString()),

    supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_owned', true),

    supabase
      .from('unit_sessions')
      .select('duration_seconds')
      .eq('user_id', user.id),
  ])

  const totalUnits = totalUnitsResult.count ?? 0
  const recentUnits = recentUnitsResult.count ?? 0
  const ownedColors = ownedColorsResult.count ?? 0

  const totalSeconds =
    sessionsResult.data?.reduce((sum, session) => {
      return sum + (session.duration_seconds ?? 0)
    }, 0) ?? 0

  const timeLogged = formatDuration(totalSeconds)

  const items = [
    {
      label: 'Total Units',
      value: totalUnits.toString(),
      accent: 'text-white',
    },
    {
      label: 'Added Last 30 Days',
      value: `+${recentUnits}`,
      accent: 'text-orange-400',
    },
    {
      label: 'Time Logged',
      value: timeLogged,
      accent: 'text-white',
    },
    {
      label: 'Colors in Vault',
      value: ownedColors.toString(),
      accent: 'text-white',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            {item.label}
          </p>
          <p className={`mt-3 text-3xl font-semibold ${item.accent}`}>
            {item.value}
          </p>
        </div>
      ))}
    </section>
  )
}