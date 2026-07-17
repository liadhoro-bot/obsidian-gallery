'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ProgressWheel from '../components/progress-wheel'
import DashboardResumeButton from './dashboard-resume-button'
import DashboardUnitStatusList from './dashboard-unit-status-list'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import {
  getDashboardUnitPatchSnapshot,
  getServerDashboardUnitPatchSnapshot,
  readDashboardUnitPatchStore,
  subscribeToDashboardSync,
  type DashboardSyncStatus,
  type DashboardUnitPatch,
} from './dashboard-sync'

type DashboardFeedUnit = {
  unit_id: string
  user_id: string
  status: DashboardSyncStatus
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

type DashboardFeedResponse = {
  heroUnit: DashboardFeedUnit | null
  units: DashboardFeedUnit[]
}

type DashboardPaintingTableClientProps = {
  initialHeroUnit: DashboardFeedUnit | null
  initialUnits: DashboardFeedUnit[]
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function sortDashboardUnits(units: DashboardFeedUnit[]) {
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

function selectHeroUnit(units: DashboardFeedUnit[]) {
  return (
    units.find((unit) => unit.is_featured) ??
    [...units]
      .filter((unit) => unit.status !== 'complete')
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0] ??
    null
  )
}

function applyUnitPatch(
  unit: DashboardFeedUnit,
  patch: DashboardUnitPatch | undefined
) {
  if (!patch) {
    return unit
  }

  return {
    ...unit,
    name: patch.name ?? unit.name,
    deadline:
      patch.deadline !== undefined ? patch.deadline : unit.deadline,
    status: patch.status ?? unit.status,
    is_featured: patch.isFeatured ?? unit.is_featured,
    updated_at: patch.updatedAt ?? unit.updated_at,
    primary_image_url:
      patch.primaryImageUrl !== undefined
        ? patch.primaryImageUrl
        : unit.primary_image_url,
    last_session_at:
      patch.lastSessionAt !== undefined
        ? patch.lastSessionAt
        : unit.last_session_at,
    progress_percent:
      patch.progressPercent !== undefined
        ? patch.progressPercent
        : unit.progress_percent,
    parent_project_names:
      patch.parentProjectNames !== undefined
        ? patch.parentProjectNames
        : unit.parent_project_names,
  }
}

export default function DashboardPaintingTableClient({
  initialHeroUnit,
  initialUnits,
}: DashboardPaintingTableClientProps) {
  const [serverFeed, setServerFeed] = useState<DashboardFeedResponse>({
    heroUnit: initialHeroUnit,
    units: initialUnits,
  })
  const unitPatchSnapshot = useSyncExternalStore(
    subscribeToDashboardSync,
    getDashboardUnitPatchSnapshot,
    getServerDashboardUnitPatchSnapshot
  )

  const unitPatches = useMemo(
    () =>
      JSON.parse(unitPatchSnapshot) as ReturnType<typeof readDashboardUnitPatchStore>,
    [unitPatchSnapshot]
  )

  const units = useMemo(() => {
    return sortDashboardUnits(
      serverFeed.units.map((unit) => applyUnitPatch(unit, unitPatches[unit.unit_id]))
    )
  }, [serverFeed.units, unitPatches])

  const heroUnit = useMemo(() => {
    const patchedHero =
      serverFeed.heroUnit &&
      applyUnitPatch(serverFeed.heroUnit, unitPatches[serverFeed.heroUnit.unit_id])

    return selectHeroUnit(
      patchedHero && !units.some((unit) => unit.unit_id === patchedHero.unit_id)
        ? [patchedHero, ...units]
        : units
    )
  }, [serverFeed.heroUnit, unitPatches, units])

  useEffect(() => {
    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/dashboard/feed', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok || !isActive) {
          return
        }

        const payload = (await response.json()) as DashboardFeedResponse

        if (!isActive) {
          return
        }

        setServerFeed(payload)
      } catch {
        // Keep the optimistic patched feed if background refresh fails.
      }
    }, 180)

    return () => {
      isActive = false

      window.clearTimeout(timeoutId)
    }
  }, [unitPatchSnapshot])

  if (!heroUnit) {
    return (
      <>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            Unit in Progress
          </p>
          <p className="mt-4 text-sm text-white/60">No unit in progress yet.</p>
        </section>

        <section className="min-h-[188px]">
          <DashboardUnitStatusList units={units.map((unit) => ({
            id: unit.unit_id,
            name: unit.name,
            deadline: unit.deadline,
            created_at: unit.created_at,
            status: unit.status,
            progress: unit.progress_percent ?? 0,
            imageUrl: unit.primary_image_url || null,
            lastSession: unit.last_session_at || null,
          }))} />
        </section>
      </>
    )
  }

  const progress = heroUnit.progress_percent ?? 0
  const unitHref = `/units/${heroUnit.unit_id}`
  const heroImageUrl = getSupabaseImageUrl(heroUnit.primary_image_url, {
    width: 640,
    quality: 40,
    resize: 'cover',
  })

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <Link
          href={unitHref}
          className="absolute inset-0 z-20"
          aria-label={`Open ${heroUnit.name}`}
        >
          <span className="sr-only">Open {heroUnit.name}</span>
        </Link>

        <div className="relative min-h-[300px] sm:min-h-[320px]">
          {heroImageUrl ? (
            <>
              <Image
                src={heroImageUrl}
                alt={heroUnit.name}
                fill
                className="object-cover"
                sizes="(max-width: 480px) calc(100vw - 2rem), (max-width: 768px) 420px, 480px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/60 to-[#081018]/15" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900" />
          )}

          <div className="relative z-10 flex min-h-[300px] flex-col justify-end p-5 sm:min-h-[320px] sm:p-6">
            <div className="flex items-end justify-between gap-4 sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                  {heroUnit.is_featured ? 'Featured Unit' : 'In Progress'}
                </p>

                <div className="mt-3 space-y-2">
                  <h2 className="max-w-xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
                    {heroUnit.name}
                  </h2>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/85 sm:text-sm">
                    Deadline: {formatDate(heroUnit.deadline)}
                  </p>
                  {heroUnit.is_featured &&
                  (heroUnit.parent_project_names?.length ?? 0) > 0 ? (
                    <p className="text-xs font-semibold text-cyan-200/80">
                      {heroUnit.parent_project_names?.join(' / ')}
                    </p>
                  ) : null}
                </div>
                <div className="relative z-30 mt-5">
                  <DashboardResumeButton unitId={heroUnit.unit_id} />
                </div>
              </div>

              <ProgressWheel value={progress} className="shrink-0 self-end" />
            </div>
          </div>
        </div>
      </section>

      <section className="min-h-[188px]">
        <DashboardUnitStatusList
          units={units.map((unit) => ({
            id: unit.unit_id,
            name: unit.name,
            deadline: unit.deadline,
            created_at: unit.created_at,
            status: unit.status,
            progress: unit.progress_percent ?? 0,
            imageUrl: unit.primary_image_url || null,
            lastSession: unit.last_session_at || null,
          }))}
        />
      </section>
    </>
  )
}
