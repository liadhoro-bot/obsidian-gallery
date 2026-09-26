import type { ReactNode } from 'react'

// One tab, one account, one snapshot. Never persist private dashboard data.
const MAX_AGE_MS = 5 * 60 * 1000
type Snapshot = { userId: string; savedAt: number; render: (href: string) => ReactNode }
let snapshot: Snapshot | null = null
let userId: string | null | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

export function subscribeDashboardReturn(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getDashboardReturn() {
  return snapshot && snapshot.userId === userId && Date.now() - snapshot.savedAt < MAX_AGE_MS
    ? snapshot : null
}

export function clearDashboardReturn() {
  snapshot = null
  emit()
}

export function setDashboardReturnUser(nextUserId: string | null) {
  if (snapshot && snapshot.userId !== nextUserId) snapshot = null
  userId = nextUserId
  emit()
}

export function rememberDashboardReturn(accountId: string, render: Snapshot['render']) {
  // The first auth event may arrive after the authenticated server page mounts.
  if (userId !== undefined && userId !== accountId) return
  snapshot = { userId: accountId, savedAt: Date.now(), render }
  emit()
}
