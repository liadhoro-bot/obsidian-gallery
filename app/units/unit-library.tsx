'use client'

import Image from 'next/image'
import UnitListView from '../../components/units/unit-list-view'
import PrefetchLink from '../components/prefetch-link'
import DashboardResumeButton from '../dashboard/dashboard-resume-button'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'

type UnitFeed = {
  unit_id: string
  status: string
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

type UnitsLibraryProps = {
  units: UnitFeed[]
  heroUnit: UnitFeed | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function sortUnits(units: UnitFeed[]) {
  return [...units].sort((a, b) => {
    const createdAtSort =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

    if (a.deadline && b.deadline) {
      const deadlineSort =
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()

      return deadlineSort || createdAtSort
    }

    if (a.deadline) return -1
    if (b.deadline) return 1

    if (a.last_session_at && b.last_session_at) {
      const sessionSort =
        new Date(b.last_session_at).getTime() -
        new Date(a.last_session_at).getTime()

      return sessionSort || createdAtSort
    }

    if (a.last_session_at) return -1
    if (b.last_session_at) return 1

    return createdAtSort
  })
}

export default function UnitsLibrary({
  units,
  heroUnit,
}: UnitsLibraryProps) {
  const sortedUnits = sortUnits(units)
  const featuredUnit =
    heroUnit && sortedUnits.some((unit) => unit.unit_id === heroUnit.unit_id)
      ? heroUnit
      : sortedUnits[0] ?? null
  const restUnits = sortedUnits.filter((unit) => unit.unit_id !== featuredUnit?.unit_id)

  if (!featuredUnit) {
    return (
      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-lg font-semibold text-white">No units yet.</p>
          <p className="mt-2 text-sm text-white/60">
            Start a new unit to build your painting table.
          </p>
        </div>
      </section>
    )
  }

  const heroImageUrl = getSupabaseImageUrl(featuredUnit.primary_image_url, {
    width: 840,
    quality: 50,
    resize: 'cover',
  })

  const cardUnits = (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] transition active:scale-[0.98] active:opacity-70">
        <PrefetchLink
          href={`/units/${featuredUnit.unit_id}`}
          viewportPrefetch
          className="absolute inset-0 z-10"
          aria-label={`Open ${featuredUnit.name}`}
        >
          <span className="sr-only">Open {featuredUnit.name}</span>
        </PrefetchLink>
        <div className="relative min-h-[240px]">
          {heroImageUrl ? (
            <>
              <Image
                src={heroImageUrl}
                alt={featuredUnit.name}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-[#081018]/15" />
            </>
          ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)]" />
          )}

          <div className="relative z-20 flex min-h-[240px] flex-col justify-end p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
              {featuredUnit.is_featured ? 'Featured Unit' : 'Latest Unit'}
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              {featuredUnit.name}
            </h2>

            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85">
              Deadline: {formatDate(featuredUnit.deadline)}
            </p>

            {featuredUnit.parent_project_names?.length ? (
              <p className="mt-2 text-sm text-white/70">
                {featuredUnit.parent_project_names.join(' / ')}
              </p>
            ) : null}

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                Progress: {featuredUnit.progress_percent ?? 0}%
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-cyan-400"
                  style={{ width: `${featuredUnit.progress_percent ?? 0}%` }}
                />
              </div>
            </div>

            <div className="relative z-20 mt-5">
              <DashboardResumeButton unitId={featuredUnit.unit_id} />
            </div>
          </div>
        </div>
      </article>

      {restUnits.map((unit) => {
        const imageUrl = getSupabaseImageUrl(unit.primary_image_url, {
          width: 320,
          height: 240,
          quality: 45,
          resize: 'cover',
        })

        return (
          <PrefetchLink
            key={unit.unit_id}
            href={`/units/${unit.unit_id}`}
            viewportPrefetch
            className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition active:scale-[0.98] active:opacity-70 hover:bg-white/[0.08]"
          >
            <div className="relative min-h-[110px] w-[30%]">
              {imageUrl ? (
                <>
                  <Image
                    src={imageUrl}
                    alt={unit.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)]" />
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <p className="text-lg font-semibold text-white">{unit.name}</p>
                <p className="mt-2 text-xs text-white/60">
                  Last session:{' '}
                  {unit.last_session_at
                    ? new Date(unit.last_session_at).toLocaleDateString()
                    : '-'}
                </p>
                <p className="text-xs font-semibold text-orange-400">
                  Deadline: {unit.deadline ? new Date(unit.deadline).toLocaleDateString() : '-'}
                </p>
                {unit.parent_project_names?.length ? (
                  <p className="mt-2 line-clamp-1 text-xs text-white/55">
                    {unit.parent_project_names.join(' / ')}
                  </p>
                ) : null}
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold text-cyan-300">
                  PROGRESS: {unit.progress_percent ?? 0}%
                </p>

                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-cyan-400"
                    style={{ width: `${unit.progress_percent ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </PrefetchLink>
        )
      })}
    </div>
  )

  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <UnitListView
        units={sortedUnits.map((unit) => ({
          id: unit.unit_id,
          name: unit.name,
          imageUrl: getSupabaseImageUrl(unit.primary_image_url, {
            width: 360,
            height: 270,
            quality: 45,
            resize: 'cover',
          }),
        }))}
        renderCards={() => cardUnits}
        surface="units_library"
        emptyMessage="No units yet. Start a new unit to build your painting table."
        header={(toggle) => (
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Unit Library</h2>
            <div className="shrink-0">{toggle}</div>
          </div>
        )}
      />
    </section>
  )
}
