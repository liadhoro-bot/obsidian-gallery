import type { ReactNode } from 'react'

// One account, one snapshot per Dashboard tab. Never persist private data.
const MAX_AGE_MS = 5 * 60 * 1000
export type DashboardReturnTab = 'painting-table' | 'profile'
type Snapshot = { userId: string; savedAt: number; render: (href: string) => ReactNode }
const snapshots = new Map<DashboardReturnTab, Snapshot>()
let userId: string | null | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

export function subscribeDashboardReturn(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getDashboardReturn(tab: DashboardReturnTab) {
  const snapshot = snapshots.get(tab) ?? null
  return snapshot && snapshot.userId === userId && Date.now() - snapshot.savedAt < MAX_AGE_MS
    ? snapshot : null
}

export function clearDashboardReturn() {
  snapshots.clear()
  emit()
}

export function setDashboardReturnUser(nextUserId: string | null) {
  if ([...snapshots.values()].some(snapshot => snapshot.userId !== nextUserId)) {
    snapshots.clear()
  }
  userId = nextUserId
  emit()
}

export function rememberDashboardReturn(
  accountId: string,
  tab: DashboardReturnTab,
  render: Snapshot['render']
) {
  // The first auth event may arrive after the authenticated server page mounts.
  if (userId !== undefined && userId !== accountId) return
  snapshots.set(tab, { userId: accountId, savedAt: Date.now(), render })
  emit()
}
