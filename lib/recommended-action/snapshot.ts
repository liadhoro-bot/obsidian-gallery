import type { SupabaseClient } from '@supabase/supabase-js'
import { toExperienceLevel, toPersona } from './persona'
import type {
  ActivitySummary,
  EngineSnapshot,
  FeatureFamily,
  ProgressStepKey,
  SnapshotGuide,
  SnapshotOnboarding,
  SnapshotProject,
  SnapshotSession,
  SnapshotUnit,
  UnitActivity,
  UnitStatus,
} from './types'

// Read-only loader for the engine. Every query is scoped to the signed-in
// user and goes through the caller's RLS client — never the service role.
// Two parallel rounds, bounded row counts, no per-unit queries.

const UNIT_LIMIT = 40
// Active and featured units are loaded on top of the most recently edited
// ones: sessions and stage changes don't bump units.updated_at, so a unit
// painted yesterday can otherwise fall outside the window.
const WORKING_UNIT_LIMIT = 40
const MAX_UNITS = 80
const PROJECT_LIMIT = 50
const GUIDE_LIMIT = 30

export const PROGRESS_STEP_ORDER: readonly ProgressStepKey[] = [
  'assembled',
  'primed',
  'initial_paints',
  'fine_details',
  'base_rim',
  'done',
]

const UNIT_COLUMNS = 'id, name, status, is_featured, image_url, created_at, updated_at, deadline'
const SESSION_COLUMNS = 'id, unit_id, started_at, ended_at, notes, duration_seconds'

const UNIT_STATUSES: readonly UnitStatus[] = ['complete', 'active', 'bench', 'pile', 'other']

export class SnapshotLoadError extends Error {
  constructor(readonly sources: string[]) {
    super(`Recommended action snapshot failed: ${sources.join(', ')}`)
    this.name = 'SnapshotLoadError'
  }
}

type ProgressRow = { unit_id: string; step_key: string; status: string }
type LegacyProgressRow = { unit_id: string; stage_key: string; is_done: boolean }

export type UnitProgressSummary = {
  lastDoneStepKey: ProgressStepKey | null
  hasRecordedProgress: boolean
}

// unit_progress_steps is the live table; unit_stage_progress is legacy and
// only read so older units aren't mistaken for "never recorded".
export function summarizeUnitProgress(
  steps: ProgressRow[],
  legacy: LegacyProgressRow[] = []
): UnitProgressSummary {
  const doneKeys = new Set<string>([
    ...steps.filter((step) => step.status === 'done').map((step) => step.step_key),
    ...legacy.filter((row) => row.is_done).map((row) => row.stage_key),
  ])
  const lastDoneStepKey =
    [...PROGRESS_STEP_ORDER].reverse().find((key) => doneKeys.has(key)) ?? null

  return {
    lastDoneStepKey,
    hasRecordedProgress:
      doneKeys.size > 0 || steps.some((step) => step.status && step.status !== 'pending'),
  }
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>()

  for (const row of rows) {
    const id = key(row)
    groups.set(id, [...(groups.get(id) ?? []), row])
  }

  return groups
}

function toSession(
  row: {
    id: string
    unit_id: string
    started_at: string
    ended_at: string | null
    notes: string | null
    duration_seconds?: number | null
  } | null
): SnapshotSession | null {
  return row
    ? {
        id: row.id,
        unitId: row.unit_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        hasNotes: Boolean(row.notes?.trim()),
        durationSeconds: row.duration_seconds ?? null,
      }
    : null
}

const FAMILIES: readonly FeatureFamily[] = ['painting', 'paints', 'guides', 'discovery']

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

function time(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null
}

function list(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

// Maps the recommended_action_activity() JSON onto typed, defensive values.
// Anything malformed reads as zero / unknown, never as invented activity.
export function parseActivity(raw: unknown): ActivitySummary | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  const families = (data.families ?? {}) as Record<string, Record<string, unknown> | undefined>

  const units: Record<string, UnitActivity> = {}
  for (const row of list(data.units)) {
    if (typeof row.unit_id !== 'string') continue
    units[row.unit_id] = {
      lastActivityAt: time(row.last_at),
      sessions7: count(row.sessions_7),
      sessions30: count(row.sessions_30),
      sessionsTotal: count(row.sessions_total),
      lastSessionAt: time(row.last_session_at),
      lastStageChangeAt: time(row.last_stage_at),
      lastPhotoAt: time(row.last_photo_at),
      actions30: count(row.actions_30),
      paletteCount: count(row.palette_count),
      guideLinkCount: count(row.guide_link_count),
    }
  }

  const projects: ActivitySummary['projects'] = {}
  for (const row of list(data.projects)) {
    if (typeof row.project_id === 'string') {
      projects[row.project_id] = { lastChildActivityAt: time(row.last_child_at) }
    }
  }

  const guides: ActivitySummary['guides'] = {}
  for (const row of list(data.guides)) {
    if (typeof row.guide_id === 'string') {
      guides[row.guide_id] = { lastEditAt: time(row.last_edit_at), contentCount: count(row.content_count) }
    }
  }

  return {
    firstMeaningfulAt: time(data.first_at),
    lastMeaningfulAt: time(data.last_at),
    daysLifetime: count(data.days_lifetime),
    actionsLifetime: count(data.actions_lifetime),
    days30: count(data.days_30),
    actions30: count(data.actions_30),
    actions7: count(data.actions_7),
    sessions30: count(data.sessions_30),
    families: Object.fromEntries(
      FAMILIES.map((family) => [
        family,
        {
          lifetime: count(families[family]?.lifetime),
          actions30: count(families[family]?.actions_30),
          days30: count(families[family]?.days_30),
          actions7: count(families[family]?.actions_7),
        },
      ])
    ) as ActivitySummary['families'],
    units,
    projects,
    guides,
  }
}

// PostgREST / Postgres codes for "function does not exist" (migration not
// applied yet). The engine then runs with low confidence instead of failing.
function isMissingFunction(error: { code?: string } | null) {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

// The one place that knows guide saves are stored against a guide's card set
// in saved_recipes. Retiring that table only means rewriting this function.
async function loadSavedGuideIds(supabase: SupabaseClient, userId: string) {
  const { data: saved } = await supabase
    .from('saved_recipes')
    .select('recipe_id')
    .eq('user_id', userId)
    .limit(500)
  const cardSetIds = (saved ?? []).map((row) => row.recipe_id as string)

  if (!cardSetIds.length) {
    return []
  }

  const [primaryResult, memberResult] = await Promise.all([
    supabase.from('guides').select('id').in('primary_recipe_id', cardSetIds),
    supabase.from('guide_decks').select('guide_id').in('recipe_id', cardSetIds),
  ])

  return [
    ...new Set([
      ...(primaryResult.data ?? []).map((row) => row.id as string),
      ...(memberResult.data ?? []).map((row) => row.guide_id as string),
    ]),
  ]
}

export async function loadEngineSnapshot(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<EngineSnapshot> {
  const [
    onboardingResult,
    projectsResult,
    unitProjectsResult,
    unitsResult,
    activeSessionResult,
    endedSessionResult,
    sessionCountResult,
    guidesResult,
    ownedPaintsResult,
    savedGuideIds,
    workingUnitsResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from('user_onboarding_flows')
      .select('goal_key, experience_level, started_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('id, name, hero_image_url, is_featured, created_at, updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(PROJECT_LIMIT),
    supabase.from('unit_projects').select('project_id').eq('user_id', userId).limit(2000),
    supabase
      .from('units')
      .select(UNIT_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(UNIT_LIMIT),
    supabase
      .from('unit_sessions')
      .select(SESSION_COLUMNS)
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('unit_sessions')
      .select(SESSION_COLUMNS)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('unit_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('ended_at', 'is', null),
    supabase
      .from('guides')
      .select('id, title, visibility, image_url, created_at, updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_auto', false)
      .order('updated_at', { ascending: false })
      .limit(GUIDE_LIMIT),
    supabase
      .from('user_paint_ownership')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_owned', true),
    loadSavedGuideIds(supabase, userId),
    supabase
      .from('units')
      .select(UNIT_COLUMNS)
      .eq('user_id', userId)
      .or('status.eq.active,is_featured.eq.true')
      .order('updated_at', { ascending: false })
      .limit(WORKING_UNIT_LIMIT),
    supabase.rpc('recommended_action_activity', { p_user_id: userId, p_now: now.toISOString() }),
  ])

  // An empty result from a failed query would read as "no projects" or "no
  // guides" and produce confidently wrong advice. Fail loudly instead; the
  // caller serves the safe fallback.
  const failed = Object.entries({
    onboarding: onboardingResult.error,
    projects: projectsResult.error,
    unit_projects: unitProjectsResult.error,
    units: unitsResult.error,
    active_session: activeSessionResult.error,
    ended_session: endedSessionResult.error,
    session_count: sessionCountResult.error,
    guides: guidesResult.error,
    owned_paints: ownedPaintsResult.error,
    working_units: workingUnitsResult.error,
    activity: isMissingFunction(activityResult.error) ? null : activityResult.error,
  }).filter(([, error]) => error)

  if (failed.length) {
    throw new SnapshotLoadError(failed.map(([name]) => name))
  }

  type UnitRow = {
    id: string
    name: string
    status: string
    is_featured: boolean
    image_url: string | null
    created_at: string
    updated_at: string
    deadline: string | null
  }

  const activity = parseActivity(activityResult.data)
  const unitRows = [...((unitsResult.data ?? []) as UnitRow[])]

  for (const unit of (workingUnitsResult.data ?? []) as UnitRow[]) {
    if (unitRows.length >= MAX_UNITS) break
    if (!unitRows.some((row) => row.id === unit.id)) unitRows.push(unit)
  }
  const activeSession = toSession(activeSessionResult.data)
  const latestEndedSession = toSession(endedSessionResult.data)

  // A running or just-ended session must be able to name its unit even when
  // that unit fell outside the recent-units window; so must the units the
  // activity read says were worked on recently or most often.
  const sessionUnitIds = [
    ...new Set([
      activeSession?.unitId,
      latestEndedSession?.unitId,
      ...Object.keys(activity?.units ?? {}),
    ]),
  ]
    .filter((id): id is string => Boolean(id) && !unitRows.some((unit) => unit.id === id))
    .slice(0, MAX_UNITS)

  if (sessionUnitIds.length) {
    const { data } = await supabase
      .from('units')
      .select(UNIT_COLUMNS)
      .eq('user_id', userId)
      .in('id', sessionUnitIds)
    unitRows.push(...((data ?? []) as UnitRow[]))
  }

  const unitIds = unitRows.map((unit) => unit.id)
  // Missing detail rows here can only produce false "add a photo" or "record
  // your stage" prompts, so these fail loudly too.
  const [stepsResult, legacyResult, imagesResult, feedResult, unitLinksResult] = unitIds.length
    ? await Promise.all([
        supabase.from('unit_progress_steps').select('unit_id, step_key, status').in('unit_id', unitIds),
        supabase.from('unit_stage_progress').select('unit_id, stage_key, is_done').in('unit_id', unitIds),
        supabase
          .from('image_assets')
          .select('entity_id, image_url, is_featured')
          .eq('entity_type', 'unit')
          .in('entity_id', unitIds),
        supabase
          .from('dashboard_unit_feed')
          .select('unit_id, last_session_at, primary_image_url')
          .in('unit_id', unitIds),
        supabase.from('unit_projects').select('unit_id, project_id').in('unit_id', unitIds),
      ])
    : [null, null, null, null, null]

  const failedDetails = Object.entries({
    progress_steps: stepsResult?.error,
    stage_progress: legacyResult?.error,
    image_assets: imagesResult?.error,
    unit_projects_detail: unitLinksResult?.error,
  }).filter(([, error]) => error)

  if (failedDetails.length) {
    throw new SnapshotLoadError(failedDetails.map(([name]) => name))
  }

  const stepsByUnit = groupBy((stepsResult?.data ?? []) as ProgressRow[], (row) => row.unit_id)
  const legacyByUnit = groupBy((legacyResult?.data ?? []) as LegacyProgressRow[], (row) => row.unit_id)
  const imagesByUnit = groupBy(
    (imagesResult?.data ?? []) as { entity_id: string; image_url: string; is_featured: boolean }[],
    (row) => row.entity_id
  )
  const feedByUnit = new Map(
    ((feedResult?.data ?? []) as { unit_id: string; last_session_at: string | null; primary_image_url: string | null }[]).map(
      (row) => [row.unit_id, row]
    )
  )
  const projectsByUnit = groupBy(
    (unitLinksResult?.data ?? []) as { unit_id: string; project_id: string }[],
    (row) => row.unit_id
  )

  const units: SnapshotUnit[] = unitRows.map((unit) => {
    const images = imagesByUnit.get(unit.id) ?? []
    const feed = feedByUnit.get(unit.id)
    const imageUrl =
      feed?.primary_image_url ??
      images.find((image) => image.is_featured)?.image_url ??
      unit.image_url ??
      images[0]?.image_url ??
      null

    return {
      id: unit.id,
      name: unit.name,
      status: UNIT_STATUSES.find((status) => status === unit.status) ?? 'other',
      isFeatured: unit.is_featured,
      imageUrl,
      hasAnyImage: Boolean(imageUrl) || images.length > 0,
      createdAt: unit.created_at,
      updatedAt: unit.updated_at,
      lastSessionAt: feed?.last_session_at ?? null,
      deadline: unit.deadline ?? null,
      ...summarizeUnitProgress(stepsByUnit.get(unit.id) ?? [], legacyByUnit.get(unit.id) ?? []),
      projectIds: (projectsByUnit.get(unit.id) ?? []).map((row) => row.project_id),
    }
  })

  const unitCountByProject = new Map<string, number>()

  for (const row of (unitProjectsResult.data ?? []) as { project_id: string }[]) {
    unitCountByProject.set(row.project_id, (unitCountByProject.get(row.project_id) ?? 0) + 1)
  }

  const projects: SnapshotProject[] = (
    (projectsResult.data ?? []) as {
      id: string
      name: string
      hero_image_url: string | null
      is_featured: boolean | null
      created_at: string
      updated_at: string
    }[]
  ).map((project) => ({
    id: project.id,
    name: project.name,
    imageUrl: project.hero_image_url,
    unitCount: unitCountByProject.get(project.id) ?? 0,
    isFeatured: Boolean(project.is_featured),
    createdAt: project.created_at,
    updatedAt: project.updated_at ?? project.created_at,
  }))

  const guides: SnapshotGuide[] = (
    (guidesResult.data ?? []) as {
      id: string
      title: string | null
      visibility: string
      image_url: string | null
      created_at: string
      updated_at: string
    }[]
  ).map((guide) => ({
    id: guide.id,
    title: guide.title?.trim() || 'Untitled guide',
    visibility:
      guide.visibility === 'public' || guide.visibility === 'private' ? guide.visibility : 'draft',
    imageUrl: guide.image_url,
    createdAt: guide.created_at,
    updatedAt: guide.updated_at ?? guide.created_at,
  }))

  const onboardingRow = onboardingResult.data as {
    goal_key: string | null
    experience_level: string | null
    started_at: string | null
  } | null
  const onboarding: SnapshotOnboarding | null = onboardingRow
    ? {
        goalKey: toPersona(onboardingRow.goal_key),
        experienceLevel: toExperienceLevel(onboardingRow.experience_level),
        startedAt: onboardingRow.started_at,
      }
    : null

  return {
    userId,
    now: now.toISOString(),
    onboarding,
    projects,
    units,
    totals: {
      projects: projectsResult.count ?? projects.length,
      units: unitsResult.count ?? units.length,
      guides: guidesResult.count ?? guides.length,
      sessions: sessionCountResult.count ?? 0,
      ownedPaints: ownedPaintsResult.count ?? 0,
      savedGuides: savedGuideIds.length,
    },
    activeSession,
    latestEndedSession,
    guides,
    activity,
    coverage: {
      unitsTruncated: (unitsResult.count ?? 0) > units.length,
      projectsTruncated: (projectsResult.count ?? 0) > projects.length,
      guidesTruncated: (guidesResult.count ?? 0) > guides.length,
    },
  }
}
