import { createClient } from '../../utils/supabase/server'

const USER_TIMEZONE = 'Asia/Jerusalem'

function formatDuration(totalSeconds: number) {
  const totalHours = Math.floor(totalSeconds / 3600)
  return `${totalHours}h`
}

function formatTimeSince(dateString: string | null) {
  if (!dateString) {
    return '—'
  }

  const then = new Date(dateString)
  const now = new Date()

  const diffMs = now.getTime() - then.getTime()

  if (diffMs <= 0) {
    return '0d 0h'
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  return `${days}d ${hours}h`
}

function getDateKeyInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function getPaintStreak(
  sessions: Array<{ created_at: string | null; duration_seconds: number | null }>,
  timeZone: string
) {
  const qualifyingDayKeys = new Set(
    sessions
      .filter((session) => (session.duration_seconds ?? 0) >= 60)
      .map((session) => {
        if (!session.created_at) return null
        return getDateKeyInTimezone(new Date(session.created_at), timeZone)
      })
      .filter((dayKey): dayKey is string => Boolean(dayKey))
  )

  let streak = 0
  const cursor = new Date()

  while (true) {
    const dayKey = getDateKeyInTimezone(cursor, timeZone)

    if (!qualifyingDayKeys.has(dayKey)) {
      break
    }

    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return `${streak}d`
}

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

  const [
    totalUnitsResult,
    recentUnitsResult,
    ownedColorsResult,
    sessionsResult,
  ] = await Promise.all([
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

    supabase
  .from('unit_sessions')
  .select('duration_seconds, created_at')
  .eq('user_id', resolvedUserId)
  .order('created_at', { ascending: false })
  .limit(120),
  ])

  const totalUnits = totalUnitsResult.count ?? 0
  const recentUnits = recentUnitsResult.count ?? 0
  const ownedColors = ownedColorsResult.count ?? 0

  const sessions = sessionsResult.data ?? []

  const totalSeconds = sessions.reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0)
  }, 0)

  const timeLogged = formatDuration(totalSeconds)
  const lastSessionAt = sessions[0]?.created_at ?? null
  const timeSinceLastSession = formatTimeSince(lastSessionAt)
  const paintStreak = getPaintStreak(sessions, USER_TIMEZONE)

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
    {
      label: 'Since Last Session',
      value: timeSinceLastSession,
      accent: 'text-white',
    },
    {
      label: 'Paint Streak',
      value: paintStreak,
      accent: 'text-orange-400',
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