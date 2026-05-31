import { Suspense } from 'react'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import UnitDetailClient from './unit-detail-client'
import UnitHeroClient from './unit-hero-client'
import { createPerfTimer } from '../../../utils/perf/server'

type PageProps = {
  params: Promise<{ id: string }>
}

type UnitDetailUnit = {
  id: string
  name: string
  complexity: number | null
  unit_size: number | null
  deadline: string | null
  is_active: boolean
  project_id: string | null
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
  [key: string]: unknown
}

type ProjectThemeRaw = {
  id: string
  name: string | null
  description: string | null
  theme_paints?: ProjectThemePaintRaw[] | null
  [key: string]: unknown
}

async function UnitDetailBody({
  id,
  userId,
  unit,
}: {
  id: string
  userId: string
  unit: UnitDetailUnit
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

  const stepsPromise = supabase
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

  const sessionsPromise = supabase
    .from('unit_sessions')
    .select(`
      id,
      started_at,
      ended_at,
      duration_seconds,
      user_id
    `)
    .eq('unit_id', id)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  const stagePaintsPromise = supabase
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
    .order('sort_order', { ascending: true })

  const projectPromise = unit.project_id
    ? supabase
        .from('projects')
        .select(`
          theme:themes (
            id,
            name,
            description,
            theme_paints (
              id,
              sort_order,
              paint_source,
              paint_catalog_id,
              custom_paint_id,
              catalog_paint:paint_catalog (
                id,
                name,
                hex_approx,
                swatch_image_url
              ),
              custom_paint:paints (
                id,
                name,
                color_hex
              )
            )
          )
        `)
        .eq('id', unit.project_id)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const [
    { data: images, error: imagesError },
    initialStepsResult,
    initialSessionsResult,
    { data: stagePaintRows, error: stagePaintsError },
    { data: project, error: projectError },
  ] = await Promise.all([
    imagesPromise,
    stepsPromise,
    sessionsPromise,
    stagePaintsPromise,
    projectPromise,
  ])
  perf.mark('secondary Supabase queries')

  if (imagesError) {
    throw new Error(imagesError.message)
  }

  let steps = initialStepsResult.data
  const stepsError = initialStepsResult.error

  if (stepsError) {
    throw new Error(stepsError.message)
  }

  if (!steps || steps.length === 0) {
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
    perf.mark('unit stage progress bootstrap')
  }

  let sessions = initialSessionsResult.data
  const sessionsError = initialSessionsResult.error

  if (sessionsError) {
    throw new Error(sessionsError.message)
  }

  const activeSession =
    sessions?.find(
      (session) =>
        session.ended_at === null && session.user_id === userId
    ) ?? null

  if (activeSession) {
    const startedAtMs = new Date(activeSession.started_at).getTime()
    const nowMs = new Date().getTime()
    const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000)

    if (elapsedSeconds >= 7200) {
      const forcedEndAt = new Date(startedAtMs + 7200 * 1000).toISOString()

      const { error: expireError } = await supabase
        .from('unit_sessions')
        .update({
          ended_at: forcedEndAt,
          duration_seconds: 7200,
        })
        .eq('id', activeSession.id)

      if (expireError) {
        throw new Error(expireError.message)
      }

      const reload = await supabase
        .from('unit_sessions')
        .select(`
          id,
          started_at,
          ended_at,
          duration_seconds,
          user_id
        `)
        .eq('unit_id', id)
        .eq('user_id', userId)
        .order('started_at', { ascending: false })

      if (reload.error) {
        throw new Error(reload.error.message)
      }

      sessions = reload.data
      perf.mark('unit sessions expiry')
    }
  }

  const totalLoggedSeconds =
    sessions?.reduce((sum, session) => {
      return sum + (session.duration_seconds ?? 0)
    }, 0) ?? 0

  const currentActiveSession =
    sessions?.find(
      (session) =>
        session.ended_at === null && session.user_id === userId
    ) ?? null

  if (stagePaintsError) {
    throw new Error(stagePaintsError.message)
  }

  if (projectError) {
    throw new Error(projectError.message)
  }

  const stagePaints =
    stagePaintRows?.map((paint) => ({
      ...paint,
      catalog_paint: Array.isArray(paint.catalog_paint)
        ? paint.catalog_paint[0] ?? null
        : paint.catalog_paint ?? null,
      custom_paint: Array.isArray(paint.custom_paint)
        ? paint.custom_paint[0] ?? null
        : paint.custom_paint ?? null,
    })) ?? []

  const projectThemeRaw = (project?.theme?.[0] ?? null) as ProjectThemeRaw | null
  perf.total()
  const projectTheme = projectThemeRaw
    ? {
        ...projectThemeRaw,
        theme_paints:
          projectThemeRaw.theme_paints?.map((paint) => ({
            ...paint,
            catalog_paint: paint.catalog_paint?.[0] ?? null,
            custom_paint: paint.custom_paint?.[0] ?? null,
          })) ?? [],
      }
    : null

  return (
    <UnitDetailClient
      unit={unit}
      projectTheme={projectTheme}
      images={images ?? []}
      steps={steps ?? []}
      totalLoggedSeconds={totalLoggedSeconds}
      activeSession={currentActiveSession}
      sessions={sessions ?? []}
      stagePaints={stagePaints}
    />
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

export default async function UnitDetailPage({ params }: PageProps) {
  const perf = createPerfTimer('/units/[id]')
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select(`
      id,
      name,
      complexity,
      unit_size,
      deadline,
      is_active,
      project_id
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (unitError || !unit) {
    notFound()
  }
  perf.mark('main Supabase query')

  const { data: featuredImage } = await supabase
    .from('image_assets')
    .select('id, image_url, is_featured, created_at, sort_order, alt_text, storage_bucket, storage_path')
    .eq('entity_type', 'unit')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  perf.mark('image/gallery queries')
  perf.total()

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar />
        </Suspense>

        <div>
          <UnitHeroClient unit={unit} featuredImage={featuredImage ?? null} />

          <Suspense fallback={<UnitDetailBodySkeleton />}>
            <UnitDetailBody
              id={id}
              userId={user.id}
              unit={unit}
            />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

