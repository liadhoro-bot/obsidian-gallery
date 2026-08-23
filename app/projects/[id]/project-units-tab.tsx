import Image from 'next/image'
import PrefetchLink from '../../components/prefetch-link'
import UnitListView from '../../../components/units/unit-list-view'
import type { ProjectUnit, SerializableError, UnitImage, UnitStage } from './types'
import styles from './project-detail-silver.module.css'

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
              href={`/units/${heroUnit.id}?preview=1`}
              viewportPrefetch
              className={`${styles.unitHeroCard} block transition active:scale-[0.98] active:opacity-70`}
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
                    <div className={styles.unitImageOverlay} />
                  </>
                ) : (
                  <div className={styles.projectHeroFallback} />
                )}

                <div className="relative z-10 flex h-full flex-col justify-end p-5">
                  <p className={styles.eyebrow}>
                    Most Recent
                  </p>

                  <h2 className="mt-2 text-2xl text-white">
                    {heroUnit.name}
                  </h2>

                  <p className="mt-1 text-sm text-white/70">
                    Last session: -
                  </p>

                  <p className="text-sm font-semibold text-[color:var(--og-brass-500)]">
                    Deadline:{' '}
                    {heroUnit.deadline
                      ? new Date(heroUnit.deadline).toLocaleDateString()
                      : '-'}
                  </p>

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase text-[color:var(--og-brass-500)]">
                      PROGRESS: {percent}%
                    </p>

                    <div className={`${styles.progressTrack} mt-1.5`}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <span className={`${styles.primaryButton} inline-flex px-5 py-3 text-sm font-bold`}>
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
              href={`/units/${unit.id}?preview=1`}
              viewportPrefetch
              className={`${styles.unitRowCard} flex transition active:scale-[0.98] active:opacity-70`}
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
                    <div className={styles.unitImageOverlay} />
                  </>
                ) : (
                  <div className={styles.projectHeroFallback} />
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <p className="text-lg font-semibold text-[color:var(--og-text-primary)]">
                    {unit.name}
                  </p>

                  <p className="mt-2 text-xs text-white/60">
                    Last session: -
                  </p>

                  <p className="text-xs font-semibold text-[color:var(--og-brass-500)]">
                    Deadline:{' '}
                    {unit.deadline
                      ? new Date(unit.deadline).toLocaleDateString()
                      : '-'}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-[color:var(--og-brass-500)]">
                    PROGRESS: {percent}%
                  </p>

                  <div className={`${styles.progressTrack} mt-1.5`}>
                    <div
                      className={styles.progressFill}
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
      <p className="text-[color:var(--og-text-secondary)]">No units yet.</p>
    )

  return (
    <section
      className={`${styles.unitViewSection} mt-3`}
      data-feature-guide-target="projects.detail.units"
    >
      {unitsError ? (
        <>
          <h2 className="text-xl">Project Units</h2>
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
            }
          })}
          renderCards={() => cardUnits}
          surface="project_detail_units"
          emptyMessage="No units yet."
          header={(toggle) => (
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl">
                Project Units
              </h2>
              <div className="shrink-0">{toggle}</div>
            </div>
          )}
        />
      ) : (
        <>
          <h2 className="text-xl">Project Units</h2>
          <p className="mt-4 text-[color:var(--og-text-secondary)]">No units yet.</p>
        </>
      )}
    </section>
  )
}
