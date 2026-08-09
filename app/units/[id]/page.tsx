import { Suspense } from 'react'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import UnitDetailClient from './unit-detail-client'
import UnitHeroClient from './unit-hero-client'
import { createPerfTimer } from '../../../utils/perf/server'
import { getDashboardProfile } from '../../dashboard/dashboard-data'
import NominateForContestCard from '../../../components/contests/nominate-for-contest-card'
import { getEligibleContestsForSource } from '../../../lib/contests/queries'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { TopBarSkeleton } from '../../dashboard/dashboard-skeletons'
import { hasV3PreviewSession } from '../../../lib/v3-preview-server'
import { getSupabaseImageUrl } from '../../../utils/images/supabase-image'
import UnitV3Preview, { type UnitV3LiveUnit } from './unit-v3-preview'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    session?: string
    tab?: string
    autostart?: string
    preview?: string
  }>
}

type UnitDetailUnit = {
  id: string
  name: string
  notes: string | null
  complexity: number | null
  unit_size: number | null
  deadline: string | null
  is_active: boolean
  is_featured: boolean
  status: 'complete' | 'active' | 'bench' | 'pile' | 'other'
  project_id: string | null
  theme_id: string | null
  completed_at: string | null
}

type UnitQueryError = {
  code?: string
  message?: string
}

function isMissingUnitColumn(
  error: UnitQueryError | null | undefined,
  column: 'completed_at' | 'theme_id'
) {
  return error?.code === '42703' && error.message?.includes(column)
}

function isMissingScheduledSessionsTable(
  error: UnitQueryError | null | undefined
) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    Boolean(error?.message?.includes('unit_scheduled_sessions'))
  )
}

type ParentProject = {
  id: string
  name: string | null
}

type UnitProjectRaw = {
  project_id: string
  project?: ParentProject[] | ParentProject | null
}

type UnitV3ImageRow = {
  id: string
  image_url: string | null
  is_featured: boolean | null
  alt_text: string | null
}

type UnitV3SessionRow = {
  id: string
  started_at: string
  duration_seconds: number | null
  notes: string | null
  entry_source: string | null
}

type UnitV3ScheduledSessionRow = {
  id: string
  scheduled_start_at: string
  focus: string
  notify: boolean
  status: string
}

type ProjectThemePaintRaw = {
  id: string
  sort_order: number | null
  paint_source: string | null
  paint_catalog_id: string | null
  custom_paint_id: string | null
  catalog_paint?: {
    id: string
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  }[] | null
  custom_paint?: {
    id: string
    name: string | null
    color_hex: string | null
  }[] | null
}

type ProjectThemeRaw = {
  id: string
  name: string | null
  description: string | null
  theme_paints?: ProjectThemePaintRaw[] | null
}

const unitThemeMarker = (unitId: string) => `[unit:${unitId}]`

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function formatUnitV3Deadline(deadline: string | null) {
  if (!deadline) {
    return 'No deadline'
  }

  const date = new Date(`${deadline}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return deadline
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatUnitV3DateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value
      return accumulator
    }, {})

  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatUnitV3Time(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '19:30'
  }

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatUnitV3Duration(totalSeconds: number | null | undefined) {
  const seconds = Math.max(0, totalSeconds ?? 0)
  const totalMinutes = Math.round(seconds / 60)
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

function getUnitV3SessionTitle(session: UnitV3SessionRow) {
  if (session.notes?.trim()) {
    return session.notes.trim().split('\n')[0] || 'Painting session'
  }

  if (session.entry_source === 'manual') {
    return 'Manual painting log'
  }

  return 'Painting session'
}

function formatUnitV3Status(status: UnitDetailUnit['status']) {
  if (status === 'bench') return 'Bench'
  if (status === 'pile') return 'Pile of shame'
  if (status === 'other') return 'Other'
  if (status === 'complete') return 'Complete'
  return 'Active'
}

async function getUnitV3PreviewUnit(id: string) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return null
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select(
      'id, name, complexity, unit_size, deadline, is_featured, status, project_id'
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (unitError) {
    throw new Error(unitError.message)
  }

  if (!unit) {
    return null
  }

  const [
    imagesResult,
    linkedProjectsResult,
    directProjectResult,
    sessionsResult,
    scheduledSessionsResult,
  ] =
    await Promise.all([
      supabase
        .from('image_assets')
        .select('id, image_url, is_featured, alt_text')
        .eq('entity_type', 'unit')
        .eq('entity_id', id)
        .eq('user_id', user.id)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('unit_projects')
        .select(
          `
          project_id,
          project:projects (
            id,
            name
          )
        `
        )
        .eq('unit_id', id)
        .eq('user_id', user.id)
        .limit(1),
      unit.project_id
        ? supabase
            .from('projects')
            .select('id, name')
            .eq('id', unit.project_id)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('unit_sessions')
        .select('id, started_at, duration_seconds, notes, entry_source')
        .eq('unit_id', id)
        .eq('user_id', user.id)
        .gt('duration_seconds', 0)
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('unit_scheduled_sessions')
        .select('id, scheduled_start_at, focus, notify, status')
        .eq('unit_id', id)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .order('scheduled_start_at', { ascending: true })
        .limit(250),
    ])

  if (imagesResult.error) {
    throw new Error(imagesResult.error.message)
  }
  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message)
  }
  if (
    scheduledSessionsResult.error &&
    !isMissingScheduledSessionsTable(
      scheduledSessionsResult.error as UnitQueryError
    )
  ) {
    throw new Error(scheduledSessionsResult.error.message)
  }

  const linkedProject = ((linkedProjectsResult.data ?? []) as UnitProjectRaw[])
    .map((row) => firstRelation(row.project))
    .find((project): project is ParentProject => Boolean(project?.id))
  const directProject = directProjectResult.data as ParentProject | null
  const projectName =
    linkedProject?.name ?? directProject?.name ?? 'Standalone unit'
  const galleryImages = ((imagesResult.data ?? []) as UnitV3ImageRow[])
    .filter((image) => Boolean(image.image_url))
    .map((image) => ({
      id: image.id,
      image:
        getSupabaseImageUrl(image.image_url, {
          width: 640,
          height: 420,
          resize: 'cover',
          quality: 76,
        }) ?? image.image_url!,
      alt: image.alt_text || unit.name || 'Unit image',
      isFeatured: image.is_featured === true,
    }))
  const featuredImage =
    galleryImages.find((image) => image.isFeatured) ?? galleryImages[0]
  const status = formatUnitV3Status(unit.status)
  const sessions = (sessionsResult.data ?? []) as UnitV3SessionRow[]
  const totalLoggedSeconds = sessions.reduce(
    (sum, session) => sum + (session.duration_seconds ?? 0),
    0
  )
  const paintSessions = sessions.map((session) => ({
    id: session.id,
    dateKey: formatUnitV3DateKey(session.started_at),
    startedAt: session.started_at,
    title: getUnitV3SessionTitle(session),
    duration: formatUnitV3Duration(session.duration_seconds),
    notes: session.notes?.trim() || '',
  }))
  const scheduledSessions = scheduledSessionsResult.error
    ? []
    : ((scheduledSessionsResult.data ?? []) as UnitV3ScheduledSessionRow[]).map(
        (session) => ({
          id: session.id,
          dateKey: formatUnitV3DateKey(session.scheduled_start_at),
          time: formatUnitV3Time(session.scheduled_start_at),
          duration: '60',
          focus: session.focus || 'Focused painting session',
          notes: '',
          notify: session.notify,
        })
      )

  return {
    id: unit.id,
    name: unit.name || 'Untitled Unit',
    label: unit.is_featured ? 'Featured' : status,
    image: featuredImage?.image ?? '/onboarding/first-project-bg.jpeg',
    galleryImages,
    project: projectName,
    deadline: formatUnitV3Deadline(unit.deadline),
    status,
    progress: unit.status === 'complete' ? 100 : 0,
    stage: unit.status === 'complete' ? 'Stage 6/6' : 'Stage 1/6',
    logged: formatUnitV3Duration(totalLoggedSeconds),
    lastPainted: paintSessions[0]?.dateKey ?? null,
    paintSessions,
    scheduledSessions,
    complexity: Math.max(1, Math.min(5, unit.complexity ?? 1)),
    modelCount: Math.max(1, unit.unit_size ?? 1),
    palette: ['#a92322', '#d6b84d', '#171821', '#e1c58d', '#72c888'],
  } satisfies UnitV3LiveUnit
}

async function UnitDetailBody({
  id,
  userId,
  unit,
  initialTab,
  showSessionStartedNotice,
  autoStartSession,
}: {
  id: string
  userId: string
  unit: UnitDetailUnit
  initialTab: 'overview' | 'progress'
  showSessionStartedNotice: boolean
  autoStartSession: boolean
}) {
  const perf = createPerfTimer('/units/[id]:details')
  const supabase = await createClient()

  const imagesPromise = supabase
    .from('image_assets')
    .select(`
      id,
      image_url,
      is_featured,
      created_at,
      sort_order,
      alt_text,
      storage_bucket,
      storage_path
    `)
    .eq('entity_type', 'unit')
    .eq('entity_id', id)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const unitThemeSelect = `
    id,
    name,
    description,
    theme_paints (
      id,
      sort_order,
      paint_source,
      paint_catalog_id,
      custom_paint_id,
      catalog_paint:paint_catalog!theme_paints_paint_catalog_id_fkey (
        id,
        name,
        hex_approx,
        swatch_image_url
      ),
      custom_paint:paints!theme_paints_custom_paint_id_fkey (
        id,
        name,
        color_hex
      )
    )
  `

  const [
    imageResult,
    sessionsResult,
    scheduledSessionsResult,
    projectResult,
    unitThemeResult,
    linkedProjectsResult,
    allProjectsResult,
    initialStepsResult,
    stagePaintsResult,
  ] = await Promise.all([
    imagesPromise,
    supabase
      .from('unit_sessions')
      .select(`
        id,
        started_at,
        ended_at,
        duration_seconds,
        user_id,
        entry_source,
        notes
      `)
      .eq('unit_id', id)
      .eq('user_id', userId)
      .order('started_at', { ascending: false }),
    supabase
      .from('unit_scheduled_sessions')
      .select(`
        id,
        unit_id,
        user_id,
        scheduled_start_at,
        focus,
        notify,
        status,
        created_at,
        updated_at
      `)
      .eq('unit_id', id)
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .order('scheduled_start_at', { ascending: true }),
    unit.project_id
      ? supabase
          .from('projects')
          .select('id, name')
          .eq('id', unit.project_id)
          .eq('user_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    unit.theme_id
      ? supabase
          .from('themes')
          .select(unitThemeSelect)
          .eq('id', unit.theme_id)
          .eq('user_id', userId)
          .maybeSingle()
      : supabase
          .from('themes')
          .select(unitThemeSelect)
          .eq('user_id', userId)
          .ilike('description', `%${unitThemeMarker(id)}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
    supabase
      .from('unit_projects')
      .select(`
        project_id,
        project:projects (
          id,
          name
        )
      `)
      .eq('unit_id', id)
      .eq('user_id', userId),
    supabase
      .from('projects')
      .select('id, name')
      .eq('user_id', userId)
      .order('name', { ascending: true }),
    supabase
      .from('unit_progress_steps')
      .select(`
        id,
        step_key,
        step_label,
        step_order,
        status,
        progress
      `)
      .eq('unit_id', id)
      .order('step_order', { ascending: true }),
    supabase
      .from('unit_stage_paints')
      .select(`
        id,
        unit_id,
        progress_step_id,
        paint_source,
        paint_catalog_id,
        custom_paint_id,
        sort_order,
        catalog_paint:paint_catalog (
          id,
          name,
          brand,
          line,
          hex_approx,
          swatch_image_url
        ),
        custom_paint:paints (
          id,
          name,
          manufacturer,
          series,
          color_hex
        )
      `)
      .eq('unit_id', id)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
  ])

  const images = imageResult.data ?? []
  const imagesError = imageResult.error

  if (
    projectResult.error ||
    unitThemeResult.error ||
    linkedProjectsResult.error ||
    allProjectsResult.error ||
    initialStepsResult.error ||
    stagePaintsResult.error ||
    (scheduledSessionsResult.error &&
      !isMissingScheduledSessionsTable(
        scheduledSessionsResult.error as UnitQueryError
      ))
  ) {
    throw new Error(
      projectResult.error?.message ||
        unitThemeResult.error?.message ||
        linkedProjectsResult.error?.message ||
        allProjectsResult.error?.message ||
        initialStepsResult.error?.message ||
        stagePaintsResult.error?.message ||
        scheduledSessionsResult.error?.message ||
        'Could not load unit detail data.'
    )
  }

  const sessions = sessionsResult.data ?? []
  const scheduledSessions = scheduledSessionsResult.error
    ? []
    : (scheduledSessionsResult.data ?? [])
  const totalLoggedSeconds = sessions.reduce(
    (sum, session) => sum + (session.duration_seconds ?? 0),
    0
  )
  const activeSession =
    sessions.find((session) => session.ended_at === null && session.user_id === userId) ??
    null

  const linkedProjectIds = ((linkedProjectsResult.data ?? []) as UnitProjectRaw[])
    .map((row) => row.project_id)
    .filter(Boolean)
  const parentProjects = ((linkedProjectsResult.data ?? []) as UnitProjectRaw[])
    .map((row) =>
      Array.isArray(row.project) ? row.project[0] ?? null : row.project ?? null
    )
    .filter((linkedProject): linkedProject is ParentProject =>
      Boolean(linkedProject?.id)
    )

  if (parentProjects.length === 0 && projectResult.data?.id) {
    parentProjects.push({
      id: projectResult.data.id,
      name: projectResult.data.name ?? null,
    })
  }

  const selectedProjectIds =
    linkedProjectIds.length > 0
      ? linkedProjectIds
      : unit.project_id
        ? [unit.project_id]
        : []
  const availableProjects = allProjectsResult.data ?? []

  const projectThemeRaw = unitThemeResult.data as ProjectThemeRaw | null
  const projectTheme = projectThemeRaw
    ? {
        ...projectThemeRaw,
        theme_paints:
          projectThemeRaw.theme_paints?.map((paint) => ({
            ...paint,
            catalog_paint: firstRelation(paint.catalog_paint),
            custom_paint: firstRelation(paint.custom_paint),
          })) ?? [],
      }
    : null

  let steps = initialStepsResult.data ?? []

  if (steps.length === 0) {
    const defaultSteps = [
      ['assembled', 'Assembled', 1],
      ['primed', 'Primed', 2],
      ['initial_paints', 'Initial Paints', 3],
      ['fine_details', 'Fine Details', 4],
      ['base_rim', 'Base & Rim', 5],
      ['done', 'Done', 6],
    ].map(([step_key, step_label, step_order]) => ({
      unit_id: id,
      step_key,
      step_label,
      step_order,
      status: 'pending',
      progress: 0,
    }))

    const { error: insertStepsError } = await supabase
      .from('unit_progress_steps')
      .insert(defaultSteps)

    if (insertStepsError) {
      throw new Error(insertStepsError.message)
    }

    const reloadSteps = await supabase
      .from('unit_progress_steps')
      .select(`
        id,
        step_key,
        step_label,
        step_order,
        status,
        progress
      `)
      .eq('unit_id', id)
      .order('step_order', { ascending: true })

    if (reloadSteps.error) {
      throw new Error(reloadSteps.error.message)
    }

    steps = reloadSteps.data ?? []
  }

  const stagePaints =
    stagePaintsResult.data?.map((paint) => ({
      ...paint,
      catalog_paint: Array.isArray(paint.catalog_paint)
        ? paint.catalog_paint[0] ?? null
        : paint.catalog_paint ?? null,
      custom_paint: Array.isArray(paint.custom_paint)
        ? paint.custom_paint[0] ?? null
        : paint.custom_paint ?? null,
    })) ?? []

  perf.mark('secondary Supabase queries')

  if (imagesError) {
    throw new Error(imagesError.message)
  }

  perf.total()

  return (
    <UnitDetailClient
      unit={unit}
      projectTheme={projectTheme}
      images={images}
      steps={steps}
      totalLoggedSeconds={totalLoggedSeconds}
      activeSession={activeSession}
      sessions={sessions}
      scheduledSessions={scheduledSessions}
      stagePaints={stagePaints}
      parentProjects={parentProjects}
      availableProjects={availableProjects}
      selectedProjectIds={selectedProjectIds}
      initialTab={initialTab}
      currentUserId={userId}
      autoStartSession={autoStartSession}
      showSessionStartedNotice={showSessionStartedNotice}
    />
  )
}

async function UnitContestCard({
  userId,
  unitId,
}: {
  userId: string
  unitId: string
}) {
  const contests = await getEligibleContestsForSource(userId, 'unit', unitId)

  return (
    <NominateForContestCard
      contests={contests}
      sourceType="unit"
      sourceId={unitId}
    />
  )
}

async function UnitContestCardGate({
  userId,
  unitId,
}: {
  userId: string
  unitId: string
}) {
  const canSeeContestNominationCard = await isCurrentUserAdmin(userId)

  if (!canSeeContestNominationCard) {
    return null
  }

  return (
    <div className="mt-5">
      <UnitContestCard userId={userId} unitId={unitId} />
    </div>
  )
}

function UnitDetailBodySkeleton() {
  return (
    <div className="mt-4 grid gap-5 animate-pulse">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1">
        <div className="h-10 rounded-xl bg-white/10" />
        <div className="h-10 rounded-xl bg-white/10" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="h-12 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
          <div className="h-12 rounded bg-white/10" />
        </div>
      </div>
    </div>
  )
}

function UnitContestCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="mt-3 h-10 rounded-2xl bg-white/[0.05]" />
    </div>
  )
}

export default async function UnitDetailPage({ params, searchParams }: PageProps) {
  const perf = createPerfTimer('/units/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  if (isPreview) {
    const previewTab =
      resolvedSearchParams.tab === 'paint' ||
      resolvedSearchParams.tab === 'progress'
        ? resolvedSearchParams.tab
        : 'details'
    const liveUnit = await getUnitV3PreviewUnit(id)

    perf.total()
    return <UnitV3Preview id={id} initialTab={previewTab} liveUnit={liveUnit} />
  }

  const showSessionStartedNotice = resolvedSearchParams.session === 'started'
  const autoStartSession = resolvedSearchParams.autostart === '1'
  const initialTab =
    resolvedSearchParams.tab === 'progress' ? 'progress' : 'overview'

  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const profilePromise = perf.measure('topbar profile fetch', async () => ({
    data: await getDashboardProfile(user.id),
  }))

  const featuredImagePromise = supabase
    .from('image_assets')
    .select(
      'id, image_url, is_featured, created_at, sort_order, alt_text, storage_bucket, storage_path'
    )
    .eq('entity_type', 'unit')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const unitSelectWithTheme = `
      id,
      name,
      notes,
      complexity,
      unit_size,
      deadline,
      is_active,
      is_featured,
      status,
      project_id,
      completed_at,
      theme_id
    `
  const unitSelectWithoutTheme = `
      id,
      name,
      notes,
      complexity,
      unit_size,
      deadline,
      is_active,
      is_featured,
      status,
      project_id,
      completed_at
    `
  const unitSelectWithoutCompletedAt = `
      id,
      name,
      notes,
      complexity,
      unit_size,
      deadline,
      is_active,
      is_featured,
      status,
      project_id,
      theme_id
    `
  const unitSelectWithoutThemeOrCompletedAt = `
      id,
      name,
      notes,
      complexity,
      unit_size,
      deadline,
      is_active,
      is_featured,
      status,
      project_id
    `

  let { data: unit, error: unitError } = await supabase
    .from('units')
    .select(unitSelectWithTheme)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const queryError = unitError as UnitQueryError | null
  if (isMissingUnitColumn(queryError, 'theme_id')) {
    const fallbackResult = await supabase
      .from('units')
      .select(unitSelectWithoutTheme)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    unit = fallbackResult.data
      ? {
          ...fallbackResult.data,
          theme_id: null,
          completed_at: fallbackResult.data.completed_at ?? null,
        }
      : null
    unitError = fallbackResult.error

    const fallbackError = unitError as UnitQueryError | null
    if (isMissingUnitColumn(fallbackError, 'completed_at')) {
      const finalFallbackResult = await supabase
        .from('units')
        .select(unitSelectWithoutThemeOrCompletedAt)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      unit = finalFallbackResult.data
        ? {
            ...finalFallbackResult.data,
            theme_id: null,
            completed_at: null,
          }
        : null
      unitError = finalFallbackResult.error
    }
  } else if (isMissingUnitColumn(queryError, 'completed_at')) {
    const fallbackResult = await supabase
      .from('units')
      .select(unitSelectWithoutCompletedAt)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    unit = fallbackResult.data
      ? {
          ...fallbackResult.data,
          completed_at: null,
        }
      : null
    unitError = fallbackResult.error

    const fallbackError = unitError as UnitQueryError | null
    if (isMissingUnitColumn(fallbackError, 'theme_id')) {
      const finalFallbackResult = await supabase
        .from('units')
        .select(unitSelectWithoutThemeOrCompletedAt)
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      unit = finalFallbackResult.data
        ? {
            ...finalFallbackResult.data,
            theme_id: null,
            completed_at: null,
          }
        : null
      unitError = finalFallbackResult.error
    }
  }

  if (unitError || !unit) {
    const finalError = unitError as UnitQueryError | null
    if (finalError?.code === 'PGRST116' || (!finalError && !unit)) {
      notFound()
    }

    throw new Error(finalError?.message || 'Could not load unit detail.')
  }
  perf.mark('main Supabase query')

  const { data: featuredImage } = await featuredImagePromise
  perf.mark('image/gallery queries')
  perf.total()
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={<TopBarSkeleton />}>
          <DashboardTopBar profilePromise={profilePromise} />
        </Suspense>

        <div>
          <UnitHeroClient unit={unit} featuredImage={featuredImage ?? null} />

          <Suspense
            fallback={
              <div className="mt-5">
                <UnitContestCardSkeleton />
              </div>
            }
          >
            <UnitContestCardGate userId={user.id} unitId={id} />
          </Suspense>

          <Suspense fallback={<UnitDetailBodySkeleton />}>
            <UnitDetailBody
              id={id}
              userId={user.id}
              unit={unit}
              initialTab={initialTab}
              autoStartSession={autoStartSession}
              showSessionStartedNotice={showSessionStartedNotice}
            />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
