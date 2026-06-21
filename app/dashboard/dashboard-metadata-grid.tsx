import { createClient } from '../../utils/supabase/server'
import DashboardMetadataCards, {
  type DashboardMetadataItem,
} from './dashboard-metadata-cards'

const USER_TIMEZONE = 'Asia/Jerusalem'

function formatDuration(totalSeconds: number) {
  const totalHours = Math.floor(totalSeconds / 3600)
  return `${totalHours}h`
}

function formatSessionLength(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return '0m'
  }

  const totalMinutes = Math.round(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function formatWeeklySessions(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0/wk'
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)}/wk`
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

type DashboardSession = {
  created_at: string | null
  duration_seconds: number | null
}

async function fetchAllSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const pageSize = 1000
  const sessions: DashboardSession[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('unit_sessions')
      .select('duration_seconds, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    const page = data ?? []
    sessions.push(...page)

    if (page.length < pageSize) {
      return sessions
    }
  }
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
    sessions,
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

    fetchAllSessions(supabase, resolvedUserId),
  ])

  const totalUnits = totalUnitsResult.count ?? 0
  const recentUnits = recentUnitsResult.count ?? 0
  const ownedColors = ownedColorsResult.count ?? 0

  const totalSeconds = sessions.reduce((sum, session) => {
    return sum + (session.duration_seconds ?? 0)
  }, 0)

  const completedSessions = sessions.filter(
    (session) => (session.duration_seconds ?? 0) > 0
  )
  const averageSessionSeconds =
    completedSessions.length > 0
      ? completedSessions.reduce((sum, session) => {
          return sum + (session.duration_seconds ?? 0)
        }, 0) / completedSessions.length
      : 0
  const datedSessions = sessions.filter(
    (session): session is DashboardSession & { created_at: string } =>
      Boolean(session.created_at)
  )
  const oldestSessionAt = datedSessions[datedSessions.length - 1]?.created_at ?? null
  const newestSessionAt = datedSessions[0]?.created_at ?? null
  const sessionSpanWeeks =
    oldestSessionAt && newestSessionAt
      ? Math.max(
          1,
          (new Date(newestSessionAt).getTime() -
            new Date(oldestSessionAt).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      : 0
  const averageSessionsPerWeek =
    datedSessions.length > 0 ? datedSessions.length / sessionSpanWeeks : 0

  const timeLogged = formatDuration(totalSeconds)
  const lastSessionAt = sessions[0]?.created_at ?? null
  const timeSinceLastSession = formatTimeSince(lastSessionAt)
  const paintStreak = getPaintStreak(sessions, USER_TIMEZONE)
  const averageSessionLength = formatSessionLength(averageSessionSeconds)
  const weeklySessions = formatWeeklySessions(averageSessionsPerWeek)

  const items: DashboardMetadataItem[] = [
    {
      id: 'total-units',
      label: 'Total Units',
      value: totalUnits.toString(),
      accent: 'text-white',
    },
    {
      id: 'added-last-30-days',
      label: 'Added Last 30 Days',
      value: `+${recentUnits}`,
      accent: 'text-orange-400',
    },
    {
      id: 'time-logged',
      label: 'Time Logged',
      value: timeLogged,
      accent: 'text-white',
    },
    {
      id: 'average-session-length',
      label: 'Avg Session Length',
      value: averageSessionLength,
      accent: 'text-white',
    },
    {
      id: 'weekly-sessions',
      label: 'Weekly Sessions',
      value: weeklySessions,
      accent: 'text-orange-400',
    },
    {
      id: 'colors-in-vault',
      label: 'Colors in Vault',
      value: ownedColors.toString(),
      accent: 'text-white',
    },
    {
      id: 'since-last-session',
      label: 'Since Last Session',
      value: timeSinceLastSession,
      accent: 'text-white',
    },
    {
      id: 'paint-streak',
      label: 'Paint Streak',
      value: paintStreak,
      accent: 'text-orange-400',
    },
  ]

  return <DashboardMetadataCards items={items} />
}
