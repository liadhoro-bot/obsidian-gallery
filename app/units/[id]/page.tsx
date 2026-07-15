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

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    session?: string
    tab?: string
    autostart?: string
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

type ParentProject = {
  id: string
  name: string | null
}

type UnitProjectRaw = {
  project_id: string
  project?: ParentProject[] | ParentProject | null
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
    stagePaintsResult.error
  ) {
    throw new Error(
      projectResult.error?.message ||
        unitThemeResult.error?.message ||
        linkedProjectsResult.error?.message ||
        allProjectsResult.error?.message ||
        initialStepsResult.error?.message ||
        stagePaintsResult.error?.message ||
        'Could not load unit detail data.'
    )
  }

  const sessions = sessionsResult.data ?? []
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
