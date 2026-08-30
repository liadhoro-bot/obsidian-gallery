import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createAuthenticatedServerClient } from '../../utils/supabase/authenticated-server-client'
import { createPerfTimer } from '../../utils/perf/server'
import {
  createClient,
  getSessionAccessToken,
  getSessionUser,
} from '../../utils/supabase/server'
import { resolveOnboardingActionDestination } from '../../lib/onboarding/action-destinations'
import { onboardingActionDefinitions } from '../../lib/onboarding/action-definitions'
import { selectVisibleOnboardingActionBatch } from '../../lib/onboarding/action-batches'

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

export type DashboardPaintingTableFeed = {
  heroUnit: DashboardFeedUnit | null
  units: DashboardFeedUnit[]
}

export type DashboardMetadataSummary = {
  totalUnits: number
  recentUnits: number
  ownedColors: number
  wishlistedPaints: number
  ownedPaintBrands: number
  ownedPaintUnits: number
  timeLogged: string
  averageSessionLength: string
  weeklySessions: string
  timeSinceLastSession: string
  paintStreak: string
  totalLoggedSeconds: number
  averageSessionSeconds: number
  longestSessionSeconds: number
  longestSessionLength: string
  paintingSessionsCount: number
  activePaintingDays: number
  completedSessionsCount: number
  completedUnits: number
  modelsCompleted: number
  collectionCompletedPercent: string
  mostUsedPaint: string
  paintingTimeBuckets: DashboardPaintingTimeBucket[]
  lastSessionAt: string | null
  paintStreakDays: number
}

export type DashboardPaintingTimeBucket = {
  id: 'morning' | 'noon' | 'afternoon' | 'evening' | 'late-night'
  label: string
  count: number
  percent: number
  color: string
}

export type DashboardXpState = {
  currentLevel: number
  xpIntoLevel: number
  xpNeededForLevel: number
  xpToNextLevel: number
  progressPercent: number
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

type DashboardSessionMetricsRow = {
  created_at: string | null
  started_at?: string | null
  duration_seconds: number | null
}

type DashboardUnitMetricsRow = {
  id: string
  status: DashboardStatus | null
  model_count?: number | null
}

type DashboardOwnershipMetricsRow = {
  paint_catalog_id: string | null
  is_owned: boolean | null
  is_wishlist: boolean | null
  units_owned: number | null
  paint?:
    | {
        brand: string | null
      }[]
    | {
        brand: string | null
      }
    | null
}

type DashboardStagePaintMetricsRow = {
  paint_catalog_id: string | null
  catalog_paint?:
    | {
        name: string | null
        brand: string | null
        line: string | null
      }[]
    | {
        name: string | null
        brand: string | null
        line: string | null
      }
    | null
}

type UserOnboardingFlowRow = {
  flow_name: string | null
  subject_unit_id?: string | null
  subject_project_id?: string | null
  subject_guide_id?: string | null
  subject_session_id?: string | null
  completed_at: string | null
  dismissed_at: string | null
}

type OnboardingActionFlowRow = {
  title: string | null
  description?: string | null
}

type OnboardingFlowActionRow = {
  id: string
  action_key?: string | null
  action_label: string | null
  action_order: number | null
  breadcrumb: string | null
  ref_page: string | null
  ref_component: string | null
  milestone_key?: string | null
  milestone_label?: string | null
  milestone_order?: number | null
}

type OnboardingActionCompletionRow = {
  flow_action_id: string
  completed_at: string
}

const canonicalOnboardingActionsByFlowKey = new Map(
  onboardingActionDefinitions.map((action) => [
    `${action.flowName}:${action.actionKey}`,
    action,
  ])
)

const legacyOnboardingActionKeys = new Map([
  ['paint_miniature:add_or_photograph_miniature', 'create_unit'],
  ['paint_miniature:choose_beginner_guide', 'choose_unit_guide'],
  ['paint_miniature:complete_first_painting_step', 'set_unit_progress_stage'],
  ['organize_hobby:create_first_project', 'create_project'],
  ['organize_hobby:add_unit_to_bench', 'add_unit_to_active_bench'],
  ['organize_hobby:mark_owned_paints', 'add_owned_paints'],
  ['create_content:create_custom_guide', 'create_guide'],
  ['create_content:add_showcase_photos', 'add_guide_cover'],
  ['create_content:share_completed_unit', 'finish_first_guide'],
])

export type DashboardNextActionItem = {
  id: string
  label: string
  order: number
  breadcrumb: string
  href: string
  milestoneKey: string
  milestoneLabel: string
  milestoneOrder: number
  completedAt: string | null
}

export type DashboardNextActionMilestone = {
  key: string
  label: string
  order: number
  totalCount: number
  completedCount: number
  actions: DashboardNextActionItem[]
}

export type DashboardNextActionsState = {
  flowName: string
  title: string
  description: string | null
  totalCount: number
  completedCount: number
  actions: DashboardNextActionItem[]
  milestones: DashboardNextActionMilestone[]
}

const UNIT_STATUSES: DashboardStatus[] = [
  'complete',
  'active',
  'bench',
  'pile',
  'other',
]

const DASHBOARD_TIMEZONE = 'Asia/Jerusalem'
const DASHBOARD_SHARED_CACHE_VERSION = 'v1'
const DASHBOARD_PROFILE_REVALIDATE_SECONDS = 60
const DASHBOARD_FEED_SELECT =
  'unit_id, user_id, status, is_featured, name, deadline, created_at, updated_at, primary_image_url, last_session_at, progress_percent, parent_project_names'
const DASHBOARD_PROGRESS_STEP_KEYS = [
  'assembled',
  'primed',
  'initial_paints',
  'fine_details',
  'base_rim',
] as const
const DASHBOARD_PAINTING_TIME_BUCKETS: DashboardPaintingTimeBucket[] = [
  { id: 'morning', label: 'Morning', count: 0, percent: 0, color: '#b96d3f' },
  { id: 'noon', label: 'Noon', count: 0, percent: 0, color: '#c99a55' },
  { id: 'afternoon', label: 'Afternoon', count: 0, percent: 0, color: '#8f7a45' },
  { id: 'evening', label: 'Evening', count: 0, percent: 0, color: '#526d72' },
  { id: 'late-night', label: 'Late-night', count: 0, percent: 0, color: '#39445e' },
] as const

function isMissingOnboardingMilestoneColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false

  return (
    error.code === 'PGRST204' ||
    /schema cache/i.test(error.message ?? '') ||
    /milestone_/i.test(error.message ?? '') ||
    /subject_.*_id/i.test(error.message ?? '')
  )
}

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

function formatCompletionPercent(completed: number, total: number) {
  if (total <= 0) {
    return '0%'
  }

  return `${Math.round((completed / total) * 100)}%`
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

function getHourInTimezone(date: Date, timeZone: string) {
  const hourPart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour')?.value

  const hour = Number(hourPart)
  return Number.isFinite(hour) ? hour : 0
}

function getSessionTimestamp(session: DashboardSessionMetricsRow) {
  return session.started_at ?? session.created_at
}

function getPaintingTimeBucketId(hour: number): DashboardPaintingTimeBucket['id'] {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late-night'
}

function getPaintingTimeBuckets(
  sessions: DashboardSessionMetricsRow[],
  timeZone: string
) {
  const counts = new Map<DashboardPaintingTimeBucket['id'], number>()
  const datedSessions = sessions.filter((session) => Boolean(getSessionTimestamp(session)))

  for (const session of datedSessions) {
    const timestamp = getSessionTimestamp(session)
    if (!timestamp) continue

    const bucketId = getPaintingTimeBucketId(
      getHourInTimezone(new Date(timestamp), timeZone)
    )
    counts.set(bucketId, (counts.get(bucketId) ?? 0) + 1)
  }

  return DASHBOARD_PAINTING_TIME_BUCKETS.map((bucket) => {
    const count = counts.get(bucket.id) ?? 0

    return {
      ...bucket,
      count,
      percent: datedSessions.length
        ? Math.round((count / datedSessions.length) * 100)
        : 0,
    }
  })
}

function getFirstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function formatPaintName(
  paint: { name: string | null; brand: string | null; line: string | null } | null
) {
  if (!paint?.name) {
    return null
  }

  return paint.brand ? `${paint.brand} ${paint.name}` : paint.name
}

function getMostUsedPaint(stagePaintRows: DashboardStagePaintMetricsRow[]) {
  const paintCounts = new Map<
    string,
    {
      count: number
      label: string
    }
  >()

  for (const row of stagePaintRows) {
    if (!row.paint_catalog_id) continue

    const label = formatPaintName(getFirstRelation(row.catalog_paint))

    if (!label) continue

    const current = paintCounts.get(row.paint_catalog_id)
    paintCounts.set(row.paint_catalog_id, {
      count: (current?.count ?? 0) + 1,
      label,
    })
  }

  return (
    [...paintCounts.values()].sort((first, second) => second.count - first.count)[0]
      ?.label ?? '-'
  )
}

function buildDashboardSupplementalMetrics({
  sessions,
  units,
  ownershipRows,
  stagePaintRows,
}: {
  sessions: DashboardSessionMetricsRow[]
  units: DashboardUnitMetricsRow[]
  ownershipRows: DashboardOwnershipMetricsRow[]
  stagePaintRows: DashboardStagePaintMetricsRow[]
}) {
  const completedSessions = sessions.filter(
    (session) => (session.duration_seconds ?? 0) > 0
  )
  const activeDayKeys = new Set(
    completedSessions
      .map((session) => {
        const timestamp = getSessionTimestamp(session)
        return timestamp
          ? getDateKeyInTimezone(new Date(timestamp), DASHBOARD_TIMEZONE)
          : null
      })
      .filter((dayKey): dayKey is string => Boolean(dayKey))
  )
  const completedUnits = units.filter((unit) => unit.status === 'complete')
  const ownedRows = ownershipRows.filter((row) => row.is_owned === true)
  const ownedPaintBrands = new Set(
    ownedRows
      .map((row) => getFirstRelation(row.paint)?.brand?.trim())
      .filter((brand): brand is string => Boolean(brand))
  )

  return {
    totalUnits: units.length,
    completedUnits: completedUnits.length,
    modelsCompleted: completedUnits.reduce(
      (sum, unit) => sum + Math.max(1, unit.model_count ?? 1),
      0
    ),
    collectionCompletedPercent: formatCompletionPercent(
      completedUnits.length,
      units.length
    ),
    paintingSessionsCount: completedSessions.length,
    activePaintingDays: activeDayKeys.size,
    longestSessionSeconds: Math.max(
      0,
      ...completedSessions.map((session) => session.duration_seconds ?? 0)
    ),
    wishlistedPaints: ownershipRows.filter((row) => row.is_wishlist === true)
      .length,
    ownedPaintBrands: ownedPaintBrands.size,
    ownedPaintUnits: ownedRows.reduce(
      (sum, row) => sum + Math.max(1, row.units_owned ?? 1),
      0
    ),
    mostUsedPaint: getMostUsedPaint(stagePaintRows),
    paintingTimeBuckets: getPaintingTimeBuckets(
      completedSessions,
      DASHBOARD_TIMEZONE
    ),
  }
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

function getDashboardProgressPercent(
  status: DashboardStatus,
  stageRows: DashboardStageProgressRow[]
) {
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

  return status === 'complete' || stageDoneMap.get('done') === true
    ? 100
    : DASHBOARD_PROGRESS_STEP_KEYS.filter((key) => stageDoneMap.get(key) === true)
        .length * 20
}

export const getDashboardCurrentUser = cache(async () => {
  const supabase = await createClient()
  return getSessionUser(supabase)
})

function getCachedDashboardProfile(
  userId: string,
  accessToken: string
) {
  return unstable_cache(
    async () => {
      const supabase = createAuthenticatedServerClient(accessToken)
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, level, username, xp')
        .eq('id', userId)
        .maybeSingle()

      return (data ?? null) as DashboardProfile | null
    },
    [DASHBOARD_SHARED_CACHE_VERSION, 'dashboard-profile', userId],
    {
      tags: ['profiles'],
      revalidate: DASHBOARD_PROFILE_REVALIDATE_SECONDS,
    }
  )()
}

export const getDashboardProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const accessToken = await getSessionAccessToken(supabase)

  if (!accessToken) {
    return null
  }

  return getCachedDashboardProfile(userId, accessToken)
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
  } satisfies DashboardXpState
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

export const getDashboardHeroUnit = cache(async (userId: string) => {
  const supabase = await createClient()

  const featuredResult = await supabase
    .from('dashboard_unit_feed')
    .select(DASHBOARD_FEED_SELECT)
    .eq('user_id', userId)
    .eq('is_featured', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!featuredResult.error && featuredResult.data) {
    return featuredResult.data as DashboardFeedUnit
  }

  const inProgressResult = await supabase
    .from('dashboard_unit_feed')
    .select(DASHBOARD_FEED_SELECT)
    .eq('user_id', userId)
    .neq('status', 'complete')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!inProgressResult.error && inProgressResult.data) {
    return inProgressResult.data as DashboardFeedUnit
  }

  const heroSnapshot = await getDashboardHeroSnapshot(userId)

  if (!heroSnapshot.unit) {
    return null
  }

  const heroProjectNames = heroSnapshot.unitProjectRows
    .filter((row) => row.unit_id === heroSnapshot.unit?.id)
    .map((row) =>
      Array.isArray(row.project) ? row.project[0] ?? null : row.project ?? null
    )
    .filter((project): project is { id: string; name: string | null } =>
      Boolean(project?.id)
    )
    .map((project) => project.name || 'Untitled project')

  return {
    unit_id: heroSnapshot.unit.id,
    user_id: userId,
    status: heroSnapshot.unit.status,
    is_featured: heroSnapshot.unit.is_featured,
    name: heroSnapshot.unit.name,
    deadline: heroSnapshot.unit.deadline,
    created_at: heroSnapshot.unit.created_at,
    updated_at: heroSnapshot.unit.updated_at,
    primary_image_url: heroSnapshot.imageUrl,
    last_session_at: null,
    progress_percent: getDashboardProgressPercent(
      heroSnapshot.unit.status,
      heroSnapshot.progressRows
    ),
    parent_project_names: heroProjectNames,
  } satisfies DashboardFeedUnit
})

export const getDashboardPaintingTableFeed = cache(async (userId: string) => {
  const perf = createPerfTimer('/dashboard:data')
  const supabase = await createClient()
  const { data, error } = await perf.measure('dashboard_unit_feed query', async () =>
    supabase
      .from('dashboard_unit_feed')
      .select(DASHBOARD_FEED_SELECT)
      .eq('user_id', userId)
  )

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

    perf.total()
    return {
      heroUnit,
      units: feedUnits,
    } satisfies DashboardPaintingTableFeed
  }

  const [heroSnapshot, unitsSnapshot] = await perf.measure(
    'fallback snapshots',
    async () =>
      Promise.all([
        getDashboardHeroSnapshot(userId),
        getDashboardUnitsSnapshot(userId),
      ])
  )

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

    return {
      ...unit,
      progress_percent: getDashboardProgressPercent(unit.status, stageRows),
    }
  })

  const fallbackHeroUnit =
    normalizedUnits.find((unit) => unit.unit_id === heroSnapshot.unit?.id) ?? null

  const fallbackFeed = {
    heroUnit: fallbackHeroUnit,
    units: normalizedUnits,
  } satisfies DashboardPaintingTableFeed

  perf.total()
  return fallbackFeed
})

export const getDashboardMetadataSummary = cache(async (userId: string) => {
  const supabase = await createClient()
  const [
    metricsResult,
    completedSessionsResult,
    unitsResult,
    ownershipResult,
    sessionsResult,
    stagePaintsResult,
  ] = await Promise.all([
    supabase
      .from('dashboard_user_metrics')
      .select(
        'total_units, recent_units, owned_colors, total_logged_seconds, average_session_seconds, average_sessions_per_week, last_session_at, paint_streak_days'
      )
      .eq('user_id', userId)
      .maybeSingle<DashboardMetricsRow>(),
    supabase
      .from('unit_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('duration_seconds', 0),
    supabase
      .from('units')
      .select('id, status, model_count')
      .eq('user_id', userId),
    supabase
      .from('user_paint_ownership')
      .select(
        `
        paint_catalog_id,
        is_owned,
        is_wishlist,
        units_owned,
        paint:paint_catalog (
          brand
        )
      `
      )
      .eq('user_id', userId),
    supabase
      .from('unit_sessions')
      .select('duration_seconds, created_at, started_at')
      .eq('user_id', userId)
      .gt('duration_seconds', 0)
      .order('started_at', { ascending: false }),
    supabase
      .from('unit_stage_paints')
      .select(
        `
        paint_catalog_id,
        catalog_paint:paint_catalog (
          name,
          brand,
          line
        )
      `
      )
      .eq('user_id', userId)
      .not('paint_catalog_id', 'is', null),
  ])
  const metricsRow = metricsResult.data
  const completedSessionsCount = completedSessionsResult.count ?? 0
  const supplementalMetrics = buildDashboardSupplementalMetrics({
    sessions: (sessionsResult.data ?? []) as DashboardSessionMetricsRow[],
    units: (unitsResult.data ?? []) as DashboardUnitMetricsRow[],
    ownershipRows: (ownershipResult.data ?? []) as DashboardOwnershipMetricsRow[],
    stagePaintRows: (stagePaintsResult.data ?? []) as DashboardStagePaintMetricsRow[],
  })

  if (metricsRow) {
    return {
      totalUnits: metricsRow.total_units ?? 0,
      recentUnits: metricsRow.recent_units ?? 0,
      ownedColors: metricsRow.owned_colors ?? 0,
      wishlistedPaints: supplementalMetrics.wishlistedPaints,
      ownedPaintBrands: supplementalMetrics.ownedPaintBrands,
      ownedPaintUnits: supplementalMetrics.ownedPaintUnits,
      timeLogged: formatDuration(metricsRow.total_logged_seconds ?? 0),
      averageSessionLength: formatSessionLength(
        metricsRow.average_session_seconds ?? 0
      ),
      weeklySessions: formatWeeklySessions(
        metricsRow.average_sessions_per_week ?? 0
      ),
      timeSinceLastSession: formatTimeSince(metricsRow.last_session_at),
      paintStreak: `${metricsRow.paint_streak_days ?? 0}d`,
      totalLoggedSeconds: metricsRow.total_logged_seconds ?? 0,
      averageSessionSeconds: metricsRow.average_session_seconds ?? 0,
      longestSessionSeconds: supplementalMetrics.longestSessionSeconds,
      longestSessionLength: formatSessionLength(
        supplementalMetrics.longestSessionSeconds
      ),
      paintingSessionsCount: completedSessionsCount,
      activePaintingDays: supplementalMetrics.activePaintingDays,
      completedSessionsCount,
      completedUnits: supplementalMetrics.completedUnits,
      modelsCompleted: supplementalMetrics.modelsCompleted,
      collectionCompletedPercent: formatCompletionPercent(
        supplementalMetrics.completedUnits,
        metricsRow.total_units ?? supplementalMetrics.totalUnits
      ),
      mostUsedPaint: supplementalMetrics.mostUsedPaint,
      paintingTimeBuckets: supplementalMetrics.paintingTimeBuckets,
      lastSessionAt: metricsRow.last_session_at,
      paintStreakDays: metricsRow.paint_streak_days ?? 0,
    } satisfies DashboardMetadataSummary
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalUnitsResult,
    recentUnitsResult,
    ownedColorsResult,
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
  ])

  const sessions =
    (sessionsResult.data ?? []) as Array<{
      created_at: string | null
      started_at?: string | null
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
    wishlistedPaints: supplementalMetrics.wishlistedPaints,
    ownedPaintBrands: supplementalMetrics.ownedPaintBrands,
    ownedPaintUnits: supplementalMetrics.ownedPaintUnits,
    timeLogged: formatDuration(totalSeconds),
    averageSessionLength: formatSessionLength(averageSessionSeconds),
    weeklySessions: formatWeeklySessions(averageSessionsPerWeek),
    timeSinceLastSession: formatTimeSince(lastSessionAt),
    paintStreak: getPaintStreak(sessions, DASHBOARD_TIMEZONE),
    totalLoggedSeconds: totalSeconds,
    averageSessionSeconds,
    longestSessionSeconds: supplementalMetrics.longestSessionSeconds,
    longestSessionLength: formatSessionLength(
      supplementalMetrics.longestSessionSeconds
    ),
    paintingSessionsCount: completedSessions.length,
    activePaintingDays: supplementalMetrics.activePaintingDays,
    completedSessionsCount: completedSessions.length,
    completedUnits: supplementalMetrics.completedUnits,
    modelsCompleted: supplementalMetrics.modelsCompleted,
    collectionCompletedPercent: supplementalMetrics.collectionCompletedPercent,
    mostUsedPaint: supplementalMetrics.mostUsedPaint,
    paintingTimeBuckets: supplementalMetrics.paintingTimeBuckets,
    lastSessionAt,
    paintStreakDays:
      Number.parseInt(getPaintStreak(sessions, DASHBOARD_TIMEZONE), 10) || 0,
  } satisfies DashboardMetadataSummary
})

export const getDashboardNextActions = cache(async (userId: string) => {
  const supabase = await createClient()

  let userFlowResult = await supabase
    .from('user_onboarding_flows')
    .select(
      'flow_name, subject_unit_id, subject_project_id, subject_guide_id, subject_session_id, completed_at, dismissed_at'
    )
    .eq('user_id', userId)
    .maybeSingle<UserOnboardingFlowRow>()

  if (isMissingOnboardingMilestoneColumn(userFlowResult.error)) {
    userFlowResult = await supabase
      .from('user_onboarding_flows')
      .select('flow_name, completed_at, dismissed_at')
      .eq('user_id', userId)
      .maybeSingle<UserOnboardingFlowRow>()
  }

  if (userFlowResult.error || !userFlowResult.data?.flow_name) {
    return null
  }

  const userFlow = userFlowResult.data
  const activeFlowName = userFlow.flow_name

  if (!activeFlowName || userFlow.dismissed_at || userFlow.completed_at) {
    return null
  }

  const [flowResult, actionsResult] = await Promise.all([
    supabase
      .from('onboarding_action_flows')
      .select('title, description')
      .eq('name', activeFlowName)
      .maybeSingle<OnboardingActionFlowRow>(),
    supabase
      .from('onboarding_flow_actions')
      .select(
        'id, action_key, action_label, action_order, breadcrumb, ref_page, ref_component, milestone_key, milestone_label, milestone_order'
      )
      .eq('flow_name', activeFlowName)
      .order('action_order', { ascending: true })
  ])

  let actionRows = (actionsResult.data ?? []) as OnboardingFlowActionRow[]

  if (isMissingOnboardingMilestoneColumn(actionsResult.error)) {
    const fallbackActionsResult = await supabase
      .from('onboarding_flow_actions')
      .select('id, action_key, action_label, action_order, breadcrumb, ref_page, ref_component')
      .eq('flow_name', activeFlowName)
      .order('action_order', { ascending: true })

    if (fallbackActionsResult.error) {
      return null
    }

    actionRows = (fallbackActionsResult.data ?? []) as OnboardingFlowActionRow[]
  } else if (actionsResult.error) {
    return null
  }

  if (flowResult.error || !actionRows.length) {
    return null
  }

  const actionIds = actionRows.map((action) => action.id)

  const completionResult = await supabase
    .from('user_onboarding_action_completions')
    .select('flow_action_id, completed_at')
    .eq('user_id', userId)
    .in('flow_action_id', actionIds)

  if (completionResult.error) {
    return null
  }

  const completions = new Map(
    ((completionResult.data ?? []) as OnboardingActionCompletionRow[]).map(
      (completion) => [completion.flow_action_id, completion.completed_at]
    )
  )

  const actions = actionRows.map((action) => {
    const flowActionKey = action.action_key
      ? `${activeFlowName}:${action.action_key}`
      : null
    const canonicalAction =
      (flowActionKey
        ? canonicalOnboardingActionsByFlowKey.get(flowActionKey)
        : null) ??
      (flowActionKey
        ? canonicalOnboardingActionsByFlowKey.get(
            `${activeFlowName}:${legacyOnboardingActionKeys.get(flowActionKey)}`
          )
        : null)
    const order = canonicalAction?.actionOrder ?? action.action_order ?? 1
    const milestoneOrder =
      canonicalAction?.milestoneOrder ??
      action.milestone_order ??
      Math.ceil(order / 5)
    const milestoneKey =
      canonicalAction?.milestoneKey ??
      action.milestone_key ??
      `milestone_${milestoneOrder}`
    const milestoneLabel =
      canonicalAction?.milestoneLabel ||
      action.milestone_label || `Milestone ${milestoneOrder}`

    return {
      id: action.id,
      label: canonicalAction?.actionLabel || action.action_label || 'Next action',
      order,
      breadcrumb: canonicalAction?.breadcrumb || action.breadcrumb || 'Dashboard',
      href: resolveOnboardingActionDestination(
        {
          refPage: canonicalAction?.refPage ?? action.ref_page,
          refComponent: canonicalAction?.refComponent ?? action.ref_component,
        },
        {
          subjectUnitId: userFlow.subject_unit_id,
          subjectProjectId: userFlow.subject_project_id,
          subjectGuideId: userFlow.subject_guide_id,
          subjectSessionId: userFlow.subject_session_id,
        }
      ),
      milestoneKey,
      milestoneLabel,
      milestoneOrder,
      completedAt: completions.get(action.id) ?? null,
    } satisfies DashboardNextActionItem
  }).sort((first, second) => first.order - second.order)
  const visibleActions = selectVisibleOnboardingActionBatch(actions, 3)

  const milestones = Array.from(
    visibleActions
      .reduce<Map<string, DashboardNextActionMilestone>>((milestoneMap, action) => {
        const current =
          milestoneMap.get(action.milestoneKey) ??
          {
            key: action.milestoneKey,
            label: action.milestoneLabel,
            order: action.milestoneOrder,
            totalCount: 0,
            completedCount: 0,
            actions: [],
          }

        current.totalCount += 1
        current.completedCount += action.completedAt ? 1 : 0
        current.actions.push(action)
        milestoneMap.set(action.milestoneKey, current)

        return milestoneMap
      }, new Map())
      .values()
  ).sort((first, second) => first.order - second.order)

  return {
    flowName: activeFlowName,
    title: 'Next Action',
    description: null,
    totalCount: Math.max(3, visibleActions.length),
    completedCount: visibleActions.filter((action) => action.completedAt).length,
    actions: visibleActions,
    milestones,
  } satisfies DashboardNextActionsState
})
