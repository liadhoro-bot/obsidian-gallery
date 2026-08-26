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
  timeLogged: string
  averageSessionLength: string
  weeklySessions: string
  timeSinceLastSession: string
  paintStreak: string
  totalLoggedSeconds: number
  averageSessionSeconds: number
  completedSessionsCount: number
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
      id: 'total-units',
      label: 'Total Units',
      value: String(summary.totalUnits),
      accent: 'text-white',
    },
    {
      id: 'added-last-30-days',
      label: 'Added Last 30 Days',
      value: `+${summary.recentUnits}`,
      accent: 'text-orange-400',
    },
    {
      id: 'time-logged',
      label: 'Time Logged',
      value: summary.timeLogged,
      accent: 'text-white',
    },
    {
      id: 'average-session-length',
      label: 'Avg Session Length',
      value: summary.averageSessionLength,
      accent: 'text-white',
    },
    {
      id: 'weekly-sessions',
      label: 'Weekly Sessions',
      value: summary.weeklySessions,
      accent: 'text-orange-400',
    },
    {
      id: 'colors-in-vault',
      label: 'Colors in Paints',
      value: String(summary.ownedColors),
      accent: 'text-white',
    },
    {
      id: 'since-last-session',
      label: 'Since Last Session',
      value: summary.timeSinceLastSession,
      accent: 'text-white',
    },
    {
      id: 'paint-streak',
      label: 'Paint Streak',
      value: summary.paintStreak,
      accent: 'text-orange-400',
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
