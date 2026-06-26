import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'

export type DashboardProfile = {
  avatar_url: string | null
  level: number | null
  username: string | null
  xp?: number | null
}

export type DashboardStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'

export type DashboardUnitSnapshot = {
  id: string
  name: string
  deadline: string | null
  created_at: string
  updated_at: string
  is_featured: boolean
  status: DashboardStatus
  project_id: string | null
}

export type DashboardStageProgressRow = {
  unit_id: string
  stage_key?: string | null
  step_key?: string | null
  is_done?: boolean | null
  status?: string | null
}

export type DashboardUnitImageRow = {
  entity_id: string
  image_url: string
}

export type DashboardSessionRow = {
  unit_id: string
  started_at: string
}

export type DashboardFeedUnit = {
  unit_id: string
  user_id: string
  status: DashboardStatus
  is_featured: boolean
  name: string
  deadline: string | null
  created_at: string
  updated_at: string
  primary_image_url: string | null
  last_session_at: string | null
  progress_percent: number | null
  parent_project_names: string[] | null
}

export type DashboardUnitProjectRow = {
  unit_id: string
  project?:
    | {
        id: string
        name: string | null
      }[]
    | {
        id: string
        name: string | null
      }
    | null
}

type DashboardUnitsSnapshot = {
  units: DashboardUnitSnapshot[]
  progressRowsByUnitId: Record<string, DashboardStageProgressRow[]>
  imageMap: Map<string, string>
  lastSessionMap: Map<string, string>
  unitProjectRows: DashboardUnitProjectRow[]
}

type DashboardHeroSnapshot = {
  unit: DashboardUnitSnapshot | null
  progressRows: DashboardStageProgressRow[]
  imageUrl: string | null
  unitProjectRows: DashboardUnitProjectRow[]
}

type DashboardPaintingTableFeed = {
  heroUnit: DashboardFeedUnit | null
  units: DashboardFeedUnit[]
}

type DashboardMetadataSummary = {
  totalUnits: number
  recentUnits: number
  ownedColors: number
  timeLogged: string
  averageSessionLength: string
  weeklySessions: string
  timeSinceLastSession: string
  paintStreak: string
}

type DashboardMetricsRow = {
  total_units: number | null
  recent_units: number | null
  owned_colors: number | null
  total_logged_seconds: number | null
  average_session_seconds: number | null
  average_sessions_per_week: number | null
  last_session_at: string | null
  paint_streak_days: number | null
}

const UNIT_STATUSES: DashboardStatus[] = [
  'complete',
  'active',
  'bench',
  'pile',
  'other',
]

const DASHBOARD_TIMEZONE = 'Asia/Jerusalem'

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
    return '-'
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

export const getDashboardCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

export const getDashboardProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('avatar_url, level, username, xp')
    .eq('id', userId)
    .single()

  return (data ?? null) as DashboardProfile | null
})

export const getDashboardXpState = cache(async (userId: string) => {
  const supabase = await createClient()
  const profile = await getDashboardProfile(userId)
  const currentXp = profile?.xp ?? 0
  const currentLevel = profile?.level ?? 0

  const [currentLevelRow, nextLevelRow] = await Promise.all([
    supabase
      .from('levels')
      .select('xp_required')
      .eq('level', currentLevel)
      .maybeSingle(),
    supabase
      .from('levels')
      .select('xp_required')
      .eq('level', currentLevel + 1)
      .maybeSingle(),
  ])

  const currentLevelXp = currentLevelRow.data?.xp_required ?? 0
  const nextLevelXp = nextLevelRow.data?.xp_required ?? currentXp
  const xpIntoLevel = Math.max(0, currentXp - currentLevelXp)
  const xpNeededForLevel = Math.max(1, nextLevelXp - currentLevelXp)
  const xpToNextLevel = Math.max(0, nextLevelXp - currentXp)
  const progressPercent = Math.min(100, (xpIntoLevel / xpNeededForLevel) * 100)

  return {
    currentLevel,
    xpIntoLevel,
    xpNeededForLevel,
    xpToNextLevel,
    progressPercent,
  }
})

export const getDashboardUnitsSnapshot = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data: units, error } = await supabase
    .from('units')
    .select('id, name, deadline, created_at, updated_at, is_featured, status, project_id')
    .eq('user_id', userId)
    .in('status', UNIT_STATUSES)

  if (error || !units?.length) {
    return {
      units: [],
      progressRowsByUnitId: {},
      imageMap: new Map<string, string>(),
      lastSessionMap: new Map<string, string>(),
      unitProjectRows: [],
    } satisfies DashboardUnitsSnapshot
  }

  const dashboardUnits = units as DashboardUnitSnapshot[]
  const unitIds = dashboardUnits.map((unit) => unit.id)

  const [
    stageProgressResult,
    progressStepsResult,
    imageResult,
    sessionResult,
    unitProjectResult,
  ] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .in('unit_id', unitIds),
    supabase
      .from('unit_progress_steps')
      .select('unit_id, step_key, status')
      .in('unit_id', unitIds),
    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('is_featured', true)
      .in('entity_id', unitIds),
    supabase
      .from('unit_sessions')
      .select('unit_id, started_at')
      .in('unit_id', unitIds)
      .order('started_at', { ascending: false }),
    supabase
      .from('unit_projects')
      .select(
        `
        unit_id,
        project:projects (
          id,
          name
        )
      `
      )
      .eq('user_id', userId)
      .in('unit_id', unitIds),
  ])

  const progressRows = [
    ...((stageProgressResult.data ?? []) as DashboardStageProgressRow[]),
    ...((progressStepsResult.data ?? []) as DashboardStageProgressRow[]),
  ]
  const progressRowsByUnitId = progressRows.reduce<
    Record<string, DashboardStageProgressRow[]>
  >((rowsByUnitId, row) => {
    if (!rowsByUnitId[row.unit_id]) {
      rowsByUnitId[row.unit_id] = []
    }

    rowsByUnitId[row.unit_id].push(row)
    return rowsByUnitId
  }, {})

  const imageMap = new Map<string, string>()
  for (const row of (imageResult.data ?? []) as DashboardUnitImageRow[]) {
    imageMap.set(row.entity_id, row.image_url)
  }

  const lastSessionMap = new Map<string, string>()
  for (const row of (sessionResult.data ?? []) as DashboardSessionRow[]) {
    if (!lastSessionMap.has(row.unit_id)) {
      lastSessionMap.set(row.unit_id, row.started_at)
    }
  }

  return {
    units: dashboardUnits,
    progressRowsByUnitId,
    imageMap,
    lastSessionMap,
    unitProjectRows: (unitProjectResult.data ?? []) as DashboardUnitProjectRow[],
  } satisfies DashboardUnitsSnapshot
})

export const getDashboardHeroSnapshot = cache(async (userId: string) => {
  const supabase = await createClient()
  const unitSelect =
    'id, name, deadline, created_at, updated_at, is_featured, status, project_id'

  const [featuredResult, inProgressResult] = await Promise.all([
    supabase
      .from('units')
      .select(unitSelect)
      .eq('user_id', userId)
      .in('status', UNIT_STATUSES)
      .eq('is_featured', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('units')
      .select(unitSelect)
      .eq('user_id', userId)
      .in('status', UNIT_STATUSES)
      .neq('status', 'complete')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const unit =
    (featuredResult.data as DashboardUnitSnapshot | null) ??
    (inProgressResult.data as DashboardUnitSnapshot | null) ??
    null

  if (!unit) {
    return {
      unit: null,
      progressRows: [],
      imageUrl: null,
      unitProjectRows: [],
    } satisfies DashboardHeroSnapshot
  }

  const [
    stageProgressResult,
    progressStepsResult,
    imageResult,
    unitProjectResult,
  ] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .eq('unit_id', unit.id),
    supabase
      .from('unit_progress_steps')
      .select('unit_id, step_key, status')
      .eq('unit_id', unit.id),
    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('is_featured', true)
      .eq('entity_id', unit.id)
      .limit(1),
    supabase
      .from('unit_projects')
      .select(
        `
        unit_id,
        project:projects (
          id,
          name
        )
      `
      )
      .eq('user_id', userId)
      .eq('unit_id', unit.id),
  ])

  return {
    unit,
    progressRows: [
      ...((stageProgressResult.data ?? []) as DashboardStageProgressRow[]),
      ...((progressStepsResult.data ?? []) as DashboardStageProgressRow[]),
    ],
    imageUrl:
      ((imageResult.data ?? []) as DashboardUnitImageRow[])[0]?.image_url ?? null,
    unitProjectRows: (unitProjectResult.data ?? []) as DashboardUnitProjectRow[],
  } satisfies DashboardHeroSnapshot
})

export const getDashboardPaintingTableFeed = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_unit_feed')
    .select(
      'unit_id, user_id, status, is_featured, name, deadline, created_at, updated_at, primary_image_url, last_session_at, progress_percent, parent_project_names'
    )
    .eq('user_id', userId)

  if (!error && data) {
    const feedUnits = data as DashboardFeedUnit[]
    const heroUnit =
      feedUnits.find((unit) => unit.is_featured) ??
      [...feedUnits]
        .filter((unit) => unit.status !== 'complete')
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0] ??
      null

    return {
      heroUnit,
      units: feedUnits,
    } satisfies DashboardPaintingTableFeed
  }

  const [
    heroSnapshot,
    unitsSnapshot,
  ] = await Promise.all([
    getDashboardHeroSnapshot(userId),
    getDashboardUnitsSnapshot(userId),
  ])

  const heroProjectNames =
    heroSnapshot.unitProjectRows
      .filter((row) => row.unit_id === heroSnapshot.unit?.id)
      .map((row) =>
        Array.isArray(row.project) ? row.project[0] ?? null : row.project ?? null
      )
      .filter((project): project is { id: string; name: string | null } =>
        Boolean(project?.id)
      )
      .map((project) => project.name || 'Untitled project')

  const fallbackUnits = unitsSnapshot.units.map((unit) => ({
    unit_id: unit.id,
    user_id: userId,
    status: unit.status,
    is_featured: unit.is_featured,
    name: unit.name,
    deadline: unit.deadline,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    primary_image_url: unitsSnapshot.imageMap.get(unit.id) || null,
    last_session_at: unitsSnapshot.lastSessionMap.get(unit.id) || null,
    progress_percent:
      unit.id === heroSnapshot.unit?.id
        ? heroSnapshot.unit
          ? heroSnapshot.unit.status === 'complete'
            ? 100
            : null
          : null
        : null,
    parent_project_names:
      unit.id === heroSnapshot.unit?.id ? heroProjectNames : null,
  }))

  const normalizedUnits = fallbackUnits.map((unit) => {
    if (unit.progress_percent !== null) {
      return unit
    }

    const stageRows = unitsSnapshot.progressRowsByUnitId[unit.unit_id] ?? []
    const stageDoneMap = new Map<string, boolean>()

    for (const stage of stageRows) {
      const key = stage.stage_key ?? stage.step_key
      if (!key) continue

      const isDone = stage.is_done === true || stage.status === 'done'

      if (isDone) {
        stageDoneMap.set(key, true)
      } else if (!stageDoneMap.has(key)) {
        stageDoneMap.set(key, false)
      }
    }

    const progress =
      unit.status === 'complete' || stageDoneMap.get('done') === true
        ? 100
        : ['assembled', 'primed', 'initial_paints', 'fine_details', 'base_rim']
            .filter((key) => stageDoneMap.get(key) === true)
            .length * 20

    return {
      ...unit,
      progress_percent: progress,
    }
  })

  const fallbackHeroUnit =
    normalizedUnits.find((unit) => unit.unit_id === heroSnapshot.unit?.id) ?? null

  return {
    heroUnit: fallbackHeroUnit,
    units: normalizedUnits,
  } satisfies DashboardPaintingTableFeed
})

export const getDashboardMetadataSummary = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data: metricsRow } = await supabase
    .from('dashboard_user_metrics')
    .select(
      'total_units, recent_units, owned_colors, total_logged_seconds, average_session_seconds, average_sessions_per_week, last_session_at, paint_streak_days'
    )
    .eq('user_id', userId)
    .maybeSingle<DashboardMetricsRow>()

  if (metricsRow) {
    return {
      totalUnits: metricsRow.total_units ?? 0,
      recentUnits: metricsRow.recent_units ?? 0,
      ownedColors: metricsRow.owned_colors ?? 0,
      timeLogged: formatDuration(metricsRow.total_logged_seconds ?? 0),
      averageSessionLength: formatSessionLength(
        metricsRow.average_session_seconds ?? 0
      ),
      weeklySessions: formatWeeklySessions(
        metricsRow.average_sessions_per_week ?? 0
      ),
      timeSinceLastSession: formatTimeSince(metricsRow.last_session_at),
      paintStreak: `${metricsRow.paint_streak_days ?? 0}d`,
    } satisfies DashboardMetadataSummary
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
      .eq('user_id', userId),
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_owned', true),
    supabase
      .from('unit_sessions')
      .select('duration_seconds, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const sessions =
    (sessionsResult.data ?? []) as Array<{
      created_at: string | null
      duration_seconds: number | null
    }>

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
    (session): session is { created_at: string; duration_seconds: number | null } =>
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
  const lastSessionAt = sessions[0]?.created_at ?? null

  return {
    totalUnits: totalUnitsResult.count ?? 0,
    recentUnits: recentUnitsResult.count ?? 0,
    ownedColors: ownedColorsResult.count ?? 0,
    timeLogged: formatDuration(totalSeconds),
    averageSessionLength: formatSessionLength(averageSessionSeconds),
    weeklySessions: formatWeeklySessions(averageSessionsPerWeek),
    timeSinceLastSession: formatTimeSince(lastSessionAt),
    paintStreak: getPaintStreak(sessions, DASHBOARD_TIMEZONE),
  } satisfies DashboardMetadataSummary
})
