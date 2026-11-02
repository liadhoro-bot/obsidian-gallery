import type { RecommendedActionType } from './types'

// The only place a recommendation turns into a destination. The card sends a
// type + target id; it never receives or follows a route from the payload.
export type ActionDestination =
  | { kind: 'navigate'; href: string }
  | { kind: 'unsupported'; reason: 'not_implemented' | 'missing_target' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeId(value: string | undefined) {
  return value && UUID_PATTERN.test(value) ? value : null
}

// Action types with a working destination today. Anything else is gated out
// of the engine (see isActionTypeSupported) instead of linking somewhere vague.
const DESTINATIONS: Partial<
  Record<RecommendedActionType, (targetId: string | null) => string | null>
> = {
  CREATE_PROJECT: () => '/projects?tab=create',
  // create=1 opens the guide starters on arrival (Guides page handles it).
  CREATE_GUIDE: () => '/guides?tab=guides&create=1',
  // Project page Units tab holds "Add unit" with the project preselected.
  ADD_UNIT: (projectId) => (projectId ? `/projects/${projectId}?tab=units` : null),
  ADD_UNIT_IMAGE: (unitId) => (unitId ? `/units/${unitId}?edit=gallery` : null),
  UPDATE_UNIT_PROGRESS: (unitId) => (unitId ? `/units/${unitId}?tab=progress` : null),
  // autostart starts the timer on arrival and is a no-op when one is running.
  START_UNIT_SESSION: (unitId) => (unitId ? `/units/${unitId}?tab=paint&autostart=1` : null),
  // Targets the unit (not the session id): the paint tab shows the running
  // clock and the session history where notes are added.
  LOG_UNIT_SESSION: (unitId) => (unitId ? `/units/${unitId}?tab=paint` : null),
  SEED_PAINT_COLLECTION: () => '/paints',
  CONTINUE_GUIDE: (guideId) => (guideId ? `/guides/${guideId}?edit=1` : null),
  DISCOVER_GUIDES: () => '/guides?tab=library',
}

export function isActionTypeSupported(type: RecommendedActionType) {
  return Boolean(DESTINATIONS[type])
}

export function resolveActionDestination(
  type: RecommendedActionType,
  targetId?: string
): ActionDestination {
  const resolve = DESTINATIONS[type]

  if (!resolve) {
    return { kind: 'unsupported', reason: 'not_implemented' }
  }

  const href = resolve(safeId(targetId))

  return href ? { kind: 'navigate', href } : { kind: 'unsupported', reason: 'missing_target' }
}
