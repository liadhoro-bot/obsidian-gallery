import Image from 'next/image'
import PrefetchLink from '../components/prefetch-link'
import { createClient } from '../../utils/supabase/server'

type DashboardHeroUnit = {
  id: string
  name: string
  updated_at: string
  deadline: string | null
  is_featured: boolean
  status: string | null
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
    { data: doneRows },
    { data: featuredImages },
    { data: unitProjectRows },
  ] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, is_done')
      .in('unit_id', unitIds)
      .eq('stage_key', 'done'),

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

  const doneSet = new Set(
    (doneRows || []).filter((row) => row.is_done).map((row) => row.unit_id)
  )

  const inProgressUnit =
    (featuredUnit as DashboardHeroUnit | null) ||
    fallbackUnits.find((unit) => !doneSet.has(unit.id)) ||
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

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
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

        <div className="relative z-10 flex min-h-[260px] flex-col justify-end p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
            {inProgressUnit.is_featured ? 'Featured Unit' : 'In Progress'}
          </p>

          <div className="mt-3 space-y-2">
            <h2 className="text-3xl font-semibold leading-tight text-white">
              {inProgressUnit.name}
            </h2>
            <p className="text-sm text-white/75">
              Last updated{' '}
              {new Date(inProgressUnit.updated_at).toLocaleDateString()}
            </p>
            {inProgressUnit.is_featured && parentProjects.length > 0 ? (
              <p className="text-xs font-semibold text-cyan-200/80">
                {parentProjects.map((project) => project.name || 'Untitled project').join(' / ')}
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <PrefetchLink
              href={`/units/${inProgressUnit.id}`}
              className="inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Resume Painting
            </PrefetchLink>
          </div>
        </div>
      </div>
    </section>
  )
}
