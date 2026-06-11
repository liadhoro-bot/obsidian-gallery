import Image from 'next/image'
import PrefetchLink from '../../components/prefetch-link'
import UnitListView from '../../../components/units/unit-list-view'
import type { ProjectUnit, SerializableError, UnitImage, UnitStage } from './types'

type Props = {
  units: ProjectUnit[]
  unitsError: SerializableError | null
  stagesByUnitId: Record<string, UnitStage[]>
  imagesByUnitId: Record<string, UnitImage[]>
}

export default function ProjectUnitsTab({
  units,
  unitsError,
  stagesByUnitId,
  imagesByUnitId,
}: Props) {
  function getUnitProgress(unitId: string) {
    const stages = stagesByUnitId[unitId] ?? []
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

    if (stageDoneMap.get('done') === true) {
      return 100
    }

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

  function getPrimaryImage(unitId: string) {
    const images = imagesByUnitId[unitId] ?? []
    return images.find((img) => img.is_featured) || images[0] || null
  }

  const sortedUnits = [...units].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  const unitsWithProgress = sortedUnits.map((unit) => ({
    ...unit,
    percent: getUnitProgress(unit.id),
  }))

  const heroUnit =
    unitsWithProgress.find((unit) => unit.percent > 0) ?? unitsWithProgress[0]

  const restUnits = unitsWithProgress.filter((unit) => unit.id !== heroUnit?.id)

  const cardUnits =
    unitsWithProgress.length > 0 ? (
      <div className="space-y-4">
        {heroUnit && (() => {
          const primaryImage = getPrimaryImage(heroUnit.id)
          const percent = heroUnit.percent

          return (
            <PrefetchLink
              key={heroUnit.id}
              href={`/units/${heroUnit.id}`}
              viewportPrefetch
              className="block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] transition active:scale-[0.98] active:opacity-70"
            >
              <div className="relative min-h-[220px]">
                {primaryImage ? (
                  <>
                    <Image
                      src={primaryImage.image_url}
                      alt={heroUnit.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 420px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-neutral-900" />
                )}

                <div className="relative z-10 flex h-full flex-col justify-end p-5">
                  <p className="text-xs uppercase tracking-wider text-orange-400">
                    Most Recent
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {heroUnit.name}
                  </h2>

                  <p className="mt-1 text-sm text-white/70">
                    Last session: -
                  </p>

                  <p className="text-sm font-semibold text-orange-400">
                    Deadline:{' '}
                    {heroUnit.deadline
                      ? new Date(heroUnit.deadline).toLocaleDateString()
                      : '-'}
                  </p>

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase text-cyan-300">
                      PROGRESS: {percent}%
                    </p>

                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-cyan-400"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <span className="inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">
                      Resume Painting
                    </span>
                  </div>
                </div>
              </div>
            </PrefetchLink>
          )
        })()}

        {restUnits.map((unit) => {
          const primaryImage = getPrimaryImage(unit.id)
          const percent = unit.percent

          return (
            <PrefetchLink
              key={unit.id}
              href={`/units/${unit.id}`}
              viewportPrefetch
              className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition active:scale-[0.98] active:opacity-70 hover:bg-white/[0.08]"
            >
              <div className="relative min-h-[110px] w-[30%]">
                {primaryImage ? (
                  <>
                    <Image
                      src={primaryImage.image_url}
                      alt={unit.name}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-neutral-900" />
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <p className="text-lg font-semibold text-white">
                    {unit.name}
                  </p>

                  <p className="mt-2 text-xs text-white/60">
                    Last session: -
                  </p>

                  <p className="text-xs font-semibold text-orange-400">
                    Deadline:{' '}
                    {unit.deadline
                      ? new Date(unit.deadline).toLocaleDateString()
                      : '-'}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-cyan-300">
                    PROGRESS: {percent}%
                  </p>

                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-cyan-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </PrefetchLink>
          )
        })}
      </div>
    ) : (
      <p className="text-neutral-400">No units yet.</p>
    )

  return (
    <section className="mt-5 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      {unitsError ? (
        <>
          <h2 className="text-xl font-semibold text-white">Project Units</h2>
          <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
            {JSON.stringify(unitsError, null, 2)}
          </pre>
        </>
      ) : unitsWithProgress.length > 0 ? (
        <UnitListView
          units={unitsWithProgress.map((unit) => {
            const primaryImage = getPrimaryImage(unit.id)

            return {
              id: unit.id,
              name: unit.name,
              imageUrl: primaryImage?.image_url ?? null,
              progress: unit.percent,
              deadline: unit.deadline,
              status: unit.is_featured ? 'featured' : null,
            }
          })}
          cards={cardUnits}
          surface="project_detail_units"
          emptyMessage="No units yet."
          header={(toggle) => (
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">
                Project Units
              </h2>
              <div className="shrink-0">{toggle}</div>
            </div>
          )}
        />
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white">Project Units</h2>
          <p className="mt-4 text-neutral-400">No units yet.</p>
        </>
      )}
    </section>
  )
}
