'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import DashboardMetadataCards, {
  type DashboardMetadataItem,
} from './dashboard-metadata-cards'
import {
  clearDashboardMetadataPatchStore,
  getDashboardMetadataPatchSnapshot,
  getServerDashboardMetadataPatchSnapshot,
  readDashboardMetadataPatchStore,
  subscribeToDashboardSync,
} from './dashboard-sync'

type DashboardMetadataSummary = {
  totalUnits: number
  recentUnits: number
  ownedColors: number
  wishlistedPaints: number
  ownedPaintBrands: number
  ownedPaintUnits: number
  timeLogged: string
  averageSessionLength: string
  weeklySessions: string
  timeSinceLastSession: string
  paintStreak: string
  totalLoggedSeconds: number
  averageSessionSeconds: number
  longestSessionSeconds: number
  longestSessionLength: string
  paintingSessionsCount: number
  activePaintingDays: number
  completedSessionsCount: number
  completedUnits: number
  modelsCompleted: number
  collectionCompletedPercent: string
  mostUsedPaint: string
  paintingTimeBuckets: Array<{
    id: 'morning' | 'noon' | 'afternoon' | 'evening' | 'late-night'
    label: string
    count: number
    percent: number
    color: string
  }>
  lastSessionAt: string | null
  paintStreakDays: number
}

type DashboardMetadataResponse = {
  summary?: DashboardMetadataSummary | null
}

function formatDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 3600)}h`
}

function formatSessionLength(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return '0m'
  }

  const totalMinutes = Math.round(totalSeconds / 60)
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

function formatTimeSince(dateString: string | null) {
  if (!dateString) {
    return '-'
  }

  const then = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()

  if (diffMs <= 0) {
    return '0d 0h'
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  return `${days}d ${hours}h`
}

function buildItems(summary: DashboardMetadataSummary): DashboardMetadataItem[] {
  return [
    {
      id: 'painting-time',
      label: 'Painting Time',
      value: summary.timeLogged,
      accent: 'text-white',
    },
    {
      id: 'painting-sessions',
      label: 'Painting Sessions',
      value: String(summary.paintingSessionsCount),
      accent: 'text-white',
    },
    {
      id: 'active-painting-days',
      label: 'Active Painting Days',
      value: String(summary.activePaintingDays),
      accent: 'text-white',
    },
    {
      id: 'average-session-duration',
      label: 'Avg Session Duration',
      value: summary.averageSessionLength,
      accent: 'text-white',
    },
    {
      id: 'longest-session',
      label: 'Longest Session',
      value: summary.longestSessionLength,
      accent: 'text-orange-400',
    },
    {
      id: 'painting-times',
      label: 'Painting Times',
      value: '',
      accent: 'text-white',
      paintingTimeBuckets: summary.paintingTimeBuckets,
    },
    {
      id: 'paints-owned',
      label: 'Paints Owned',
      value: String(summary.ownedColors),
      accent: 'text-white',
    },
    {
      id: 'paints-wishlisted',
      label: 'Paints Wishlisted',
      value: String(summary.wishlistedPaints),
      accent: 'text-white',
    },
    {
      id: 'paint-brands-owned',
      label: 'Paint Brands Owned',
      value: String(summary.ownedPaintBrands),
      accent: 'text-white',
    },
    {
      id: 'most-used-paint',
      label: 'Most Used Paint',
      value: summary.mostUsedPaint,
      accent: 'text-orange-400',
    },
    {
      id: 'units-owned',
      label: 'Units Owned',
      value: String(summary.totalUnits),
      accent: 'text-white',
    },
    {
      id: 'units-completed',
      label: 'Units Completed',
      value: String(summary.completedUnits),
      accent: 'text-white',
    },
    {
      id: 'models-completed',
      label: 'Models Completed',
      value: String(summary.modelsCompleted),
      accent: 'text-white',
    },
    {
      id: 'collection-completed',
      label: 'Collection Completed',
      value: summary.collectionCompletedPercent,
      accent: 'text-white',
    },
  ]
}

function applyMetadataPatch(
  summary: DashboardMetadataSummary,
  patch: ReturnType<typeof readDashboardMetadataPatchStore>
) {
  if (!patch) {
    return summary
  }

  const nextTotalLoggedSeconds = Math.max(
    0,
    summary.totalLoggedSeconds + (patch.totalLoggedSecondsDelta ?? 0)
  )
  const nextCompletedSessionsCount = Math.max(
    0,
    summary.completedSessionsCount + (patch.completedSessionsDelta ?? 0)
  )
  const nextAverageSessionSeconds =
    nextCompletedSessionsCount > 0
      ? nextTotalLoggedSeconds / nextCompletedSessionsCount
      : 0
  const nextLastSessionAt =
    patch.lastSessionAt !== undefined ? patch.lastSessionAt : summary.lastSessionAt
  const nextPaintStreakDays = Math.max(
    summary.paintStreakDays,
    patch.paintStreakDaysFloor ?? 0
  )

  return {
    ...summary,
    totalLoggedSeconds: nextTotalLoggedSeconds,
    averageSessionSeconds: nextAverageSessionSeconds,
    completedSessionsCount: nextCompletedSessionsCount,
    lastSessionAt: nextLastSessionAt,
    paintStreakDays: nextPaintStreakDays,
    timeLogged: formatDuration(nextTotalLoggedSeconds),
    averageSessionLength: formatSessionLength(nextAverageSessionSeconds),
    timeSinceLastSession: formatTimeSince(nextLastSessionAt),
    paintStreak: `${nextPaintStreakDays}d`,
  }
}

export default function DashboardMetadataLoader({
  initialSummary,
}: {
  initialSummary: DashboardMetadataSummary
}) {
  const [serverSummary, setServerSummary] = useState(initialSummary)
  const metadataPatchSnapshot = useSyncExternalStore(
    subscribeToDashboardSync,
    getDashboardMetadataPatchSnapshot,
    getServerDashboardMetadataPatchSnapshot
  )

  const pendingPatch = useMemo(
    () =>
      JSON.parse(metadataPatchSnapshot) as ReturnType<
        typeof readDashboardMetadataPatchStore
      >,
    [metadataPatchSnapshot]
  )
  const items = useMemo(
    () => buildItems(applyMetadataPatch(serverSummary, pendingPatch)),
    [pendingPatch, serverSummary]
  )

  useEffect(() => {
    let isActive = true
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/dashboard/metadata', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as DashboardMetadataResponse

        if (!isActive || !payload.summary) {
          return
        }

        setServerSummary(payload.summary)
        clearDashboardMetadataPatchStore()
      } catch {
        // Keep the optimistic metadata if the background refresh fails.
      }
    }, 180)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [metadataPatchSnapshot])

  return <DashboardMetadataCards items={items} />
}
