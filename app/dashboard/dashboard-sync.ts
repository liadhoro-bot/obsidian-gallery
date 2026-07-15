const DASHBOARD_UNIT_PATCHES_KEY = 'obsidian-gallery:dashboard-unit-patches:v1'
const DASHBOARD_METADATA_PATCH_KEY =
  'obsidian-gallery:dashboard-metadata-patch:v1'
const DASHBOARD_SYNC_EVENT = 'dashboard-sync-change'
const DASHBOARD_PATCH_TTL_MS = 5 * 60 * 1000

export type DashboardSyncStatus =
  | 'complete'
  | 'active'
  | 'bench'
  | 'pile'
  | 'other'

export type DashboardUnitPatch = {
  unitId: string
  name?: string
  deadline?: string | null
  status?: DashboardSyncStatus
  isFeatured?: boolean
  updatedAt?: string
  progressPercent?: number | null
  primaryImageUrl?: string | null
  lastSessionAt?: string | null
  parentProjectNames?: string[] | null
}

type DashboardUnitPatchEntry = DashboardUnitPatch & {
  patchedAtMs: number
}

export type DashboardMetadataPatch = {
  totalLoggedSecondsDelta?: number
  completedSessionsDelta?: number
  lastSessionAt?: string | null
  paintStreakDaysFloor?: number
}

type DashboardMetadataPatchStore = DashboardMetadataPatch & {
  patchedAtMs: number
}

function dispatchDashboardSyncChange() {
  window.dispatchEvent(new Event(DASHBOARD_SYNC_EVENT))
}

function readJson<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return fallback
    }

    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function isFreshPatch(patchedAtMs: number | undefined) {
  return Boolean(
    patchedAtMs && Date.now() - patchedAtMs < DASHBOARD_PATCH_TTL_MS
  )
}

export function readDashboardUnitPatchStore() {
  const rawStore = readJson<Record<string, DashboardUnitPatchEntry>>(
    DASHBOARD_UNIT_PATCHES_KEY,
    {}
  )

  return Object.fromEntries(
    Object.entries(rawStore).filter(([, patch]) => isFreshPatch(patch.patchedAtMs))
  )
}

export function readDashboardMetadataPatchStore() {
  const patch = readJson<DashboardMetadataPatchStore | null>(
    DASHBOARD_METADATA_PATCH_KEY,
    null
  )

  if (!patch || !isFreshPatch(patch.patchedAtMs)) {
    return null
  }

  return patch
}

export function getDashboardUnitPatchSnapshot() {
  if (typeof window === 'undefined') {
    return '{}'
  }

  return JSON.stringify(readDashboardUnitPatchStore())
}

export function getDashboardMetadataPatchSnapshot() {
  if (typeof window === 'undefined') {
    return 'null'
  }

  return JSON.stringify(readDashboardMetadataPatchStore())
}

export function getServerDashboardUnitPatchSnapshot() {
  return '{}'
}

export function getServerDashboardMetadataPatchSnapshot() {
  return 'null'
}

export function subscribeToDashboardSync(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === DASHBOARD_UNIT_PATCHES_KEY ||
      event.key === DASHBOARD_METADATA_PATCH_KEY
    ) {
      onStoreChange()
    }
  }

  window.addEventListener(DASHBOARD_SYNC_EVENT, onStoreChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(DASHBOARD_SYNC_EVENT, onStoreChange)
    window.removeEventListener('storage', handleStorage)
  }
}

export function publishDashboardUnitPatch(patch: DashboardUnitPatch) {
  if (typeof window === 'undefined' || !patch.unitId) {
    return
  }

  const currentStore = readDashboardUnitPatchStore()
  const nextStore = {
    ...currentStore,
    [patch.unitId]: {
      ...currentStore[patch.unitId],
      ...patch,
      patchedAtMs: Date.now(),
    },
  }

  window.localStorage.setItem(
    DASHBOARD_UNIT_PATCHES_KEY,
    JSON.stringify(nextStore)
  )
  dispatchDashboardSyncChange()
}

export function publishDashboardMetadataPatch(patch: DashboardMetadataPatch) {
  if (typeof window === 'undefined') {
    return
  }

  const currentPatch = readDashboardMetadataPatchStore()
  const nextPatch: DashboardMetadataPatchStore = {
    totalLoggedSecondsDelta:
      (currentPatch?.totalLoggedSecondsDelta ?? 0) +
      (patch.totalLoggedSecondsDelta ?? 0),
    completedSessionsDelta:
      (currentPatch?.completedSessionsDelta ?? 0) +
      (patch.completedSessionsDelta ?? 0),
    lastSessionAt:
      patch.lastSessionAt !== undefined
        ? patch.lastSessionAt
        : currentPatch?.lastSessionAt,
    paintStreakDaysFloor: Math.max(
      currentPatch?.paintStreakDaysFloor ?? 0,
      patch.paintStreakDaysFloor ?? 0
    ),
    patchedAtMs: Date.now(),
  }

  window.localStorage.setItem(
    DASHBOARD_METADATA_PATCH_KEY,
    JSON.stringify(nextPatch)
  )
  dispatchDashboardSyncChange()
}

export function clearDashboardMetadataPatchStore() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(DASHBOARD_METADATA_PATCH_KEY)
  dispatchDashboardSyncChange()
}
