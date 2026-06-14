import Image from 'next/image'
import ProgressWheel from '../components/progress-wheel'
import PrefetchLink, { PrefetchButton } from '../components/prefetch-link'
import { createClient } from '../../utils/supabase/server'
import { startDashboardUnitSession } from './actions'

type StageProgressRow = {
  unit_id: string
  stage_key?: string | null
  step_key?: string | null
  is_done?: boolean | null
  status?: string | null
}

type DashboardHeroUnit = {
  id: string
  name: string
  updated_at: string
  deadline: string | null
  is_featured: boolean
  status: 'complete' | 'active' | 'bench' | 'pile' | 'other' | null
  project_id: string | null
}

type UnitProjectRow = {
  unit_id: string
  project?: {
    id: string
    name: string | null
  }[] | {
    id: string
    name: string | null
  } | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getUnitProgress(
  unit: DashboardHeroUnit,
  stages: StageProgressRow[]
) {
  if (unit.status === 'complete') return 100

  const stageDoneMap = new Map<string, boolean>()

  for (const stage of stages) {
    const key = stage.stage_key ?? stage.step_key
    if (!key) continue

    const isDone = stage.is_done === true || stage.status === 'done'

    if (isDone) {
      stageDoneMap.set(key, true)
    } else if (!stageDoneMap.has(key)) {
      stageDoneMap.set(key, false)
    }
  }

  if (stageDoneMap.get('done') === true) return 100

  const progressStageKeys = [
    'assembled',
    'primed',
    'initial_paints',
    'fine_details',
    'base_rim',
  ]

  const completed = progressStageKeys.filter(
    (key) => stageDoneMap.get(key) === true
  ).length

  return completed * 20
}

export default async function DashboardUnitInProgress({
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

  const { data: featuredUnit, error: featuredError } = await supabase
    .from('units')
    .select('id, name, updated_at, deadline, is_featured, status, project_id')
    .eq('user_id', resolvedUserId)
    .eq('is_featured', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (featuredError) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-red-300">Could not load unit.</p>
      </section>
    )
  }

  const { data: units, error } = featuredUnit
    ? { data: null, error: null }
    : await supabase
    .from('units')
    .select('id, name, updated_at, deadline, is_featured, status, project_id')
    .eq('user_id', resolvedUserId)
    .order('updated_at', { ascending: false })
    .limit(4)

  if (!featuredUnit && (error || !units?.length)) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">No unit in progress yet.</p>
      </section>
    )
  }

  const fallbackUnits = (units ?? []) as DashboardHeroUnit[]
  const unitIds = featuredUnit
    ? [featuredUnit.id]
    : fallbackUnits.map((unit) => unit.id)

  const [
    { data: stageProgressRows },
    { data: progressStepRows },
    { data: featuredImages },
    { data: unitProjectRows },
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
      .in('entity_id', unitIds)
      .eq('is_featured', true),

    supabase
      .from('unit_projects')
      .select(`
        unit_id,
        project:projects (
          id,
          name
        )
      `)
      .eq('user_id', resolvedUserId)
      .in('unit_id', unitIds),
  ])

  const progressRows = [
    ...((stageProgressRows ?? []) as StageProgressRow[]),
    ...((progressStepRows ?? []) as StageProgressRow[]),
  ]
  const progressRowsByUnitId = progressRows.reduce<Record<string, StageProgressRow[]>>(
    (rowsByUnitId, row) => {
      if (!rowsByUnitId[row.unit_id]) {
        rowsByUnitId[row.unit_id] = []
      }

      rowsByUnitId[row.unit_id].push(row)
      return rowsByUnitId
    },
    {}
  )
  const progressMap = new Map<string, number>()

  for (const unit of [featuredUnit, ...fallbackUnits].filter(Boolean) as DashboardHeroUnit[]) {
    progressMap.set(unit.id, getUnitProgress(unit, progressRowsByUnitId[unit.id] ?? []))
  }

  const inProgressUnit =
    (featuredUnit as DashboardHeroUnit | null) ||
    fallbackUnits.find((unit) => (progressMap.get(unit.id) ?? 0) < 100) ||
    null

  if (!inProgressUnit) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">
          All tracked units are currently complete.
        </p>
      </section>
    )
  }

  const featuredImage = featuredImages?.find(
    (image) => image.entity_id === inProgressUnit.id
  )
  const parentProjects =
    ((unitProjectRows ?? []) as UnitProjectRow[])
      .filter((row) => row.unit_id === inProgressUnit.id)
      .map((row) =>
        Array.isArray(row.project) ? row.project[0] ?? null : row.project ?? null
      )
      .filter((project): project is { id: string; name: string | null } =>
        Boolean(project?.id)
      )

  const progress = progressMap.get(inProgressUnit.id) ?? 0

  const unitHref = `/units/${inProgressUnit.id}`

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <PrefetchLink
        href={unitHref}
        viewportPrefetch
        className="absolute inset-0 z-10"
        aria-label={`Open ${inProgressUnit.name}`}
      >
        <span className="sr-only">Open {inProgressUnit.name}</span>
      </PrefetchLink>

      <div className="relative min-h-[260px]">
        {featuredImage?.image_url ? (
          <>
            <Image
              src={featuredImage.image_url}
              alt={inProgressUnit.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 420px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/65 to-[#081018]/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900" />
        )}

        <div className="relative z-10 flex min-h-[260px] flex-col justify-end p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                {inProgressUnit.is_featured ? 'Featured Unit' : 'In Progress'}
              </p>

              <div className="mt-3 space-y-2">
                <h2 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                  {inProgressUnit.name}
                </h2>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85 sm:text-sm">
                  Deadline: {formatDate(inProgressUnit.deadline)}
                </p>
                {inProgressUnit.is_featured && parentProjects.length > 0 ? (
                  <p className="text-xs font-semibold text-cyan-200/80">
                    {parentProjects.map((project) => project.name || 'Untitled project').join(' / ')}
                  </p>
                ) : null}
              </div>

              <form action={startDashboardUnitSession} className="relative z-20 mt-5">
                <input type="hidden" name="unitId" value={inProgressUnit.id} />
                <PrefetchButton
                  type="submit"
                  prefetchHref={unitHref}
                  className="inline-flex rounded-2xl border border-cyan-300/55 bg-black/45 px-4 py-2.5 text-xs font-black uppercase text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950 sm:px-5 sm:py-3 sm:text-sm"
                >
                  Resume Painting
                </PrefetchButton>
              </form>
            </div>

            <ProgressWheel
              value={progress}
              className="shrink-0 self-end"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
