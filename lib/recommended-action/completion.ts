import { unitProgressFingerprint } from './rules'
import type { EngineSnapshot, RuleId } from './types'

// A click is not completion. A clicked instance completes only when the
// snapshot shows the underlying action really happened after the click.
// Reconciled on the next dashboard load (spec §7: verified recomputation).

export type ClickedInstance = {
  ruleId: RuleId
  targetId: string | null
  contextHash: string
  clickedAt: string
}

// Clicked but never finished within this window: stop waiting.
export const COMPLETION_WINDOW_DAYS = 7

export type CompletionVerdict = 'completed' | 'pending' | 'expired' | 'invalidated'

function isAfter(iso: string | null | undefined, reference: string) {
  return Boolean(iso) && Date.parse(iso as string) > Date.parse(reference)
}

export function isGoalMet(instance: ClickedInstance, snapshot: EngineSnapshot): boolean {
  const { targetId, clickedAt } = instance
  const unit = targetId ? snapshot.units.find((candidate) => candidate.id === targetId) : undefined

  switch (instance.ruleId) {
    case 'RA01':
      return snapshot.totals.projects > 0
    case 'RA02':
      return snapshot.totals.guides > 0
    case 'RA03':
      return (snapshot.projects.find((project) => project.id === targetId)?.unitCount ?? 0) > 0
    case 'RA04':
      return Boolean(unit?.hasAnyImage)
    case 'RA07':
      return Boolean(unit) && unitProgressFingerprint(unit!) !== instance.contextHash
    case 'RA09':
      return (
        isAfter(unit?.lastSessionAt, clickedAt) ||
        (snapshot.activeSession?.unitId === targetId &&
          isAfter(snapshot.activeSession?.startedAt, clickedAt))
      )
    case 'RA10': {
      // The session was wrapped up: no longer running, and notes saved if it
      // is still the latest ended one (otherwise RA10 would fire again).
      if (snapshot.activeSession?.id === targetId) return false
      const latest = snapshot.latestEndedSession
      return latest?.id === targetId ? latest.hasNotes : true
    }
    case 'RA13':
      return snapshot.totals.ownedPaints > 0
    case 'RA15':
      // Card edits live in recipe_steps and don't bump guides.updated_at;
      // the activity read sees both.
      return isAfter(
        (targetId ? snapshot.activity?.guides[targetId]?.lastEditAt : null) ??
          snapshot.guides.find((guide) => guide.id === targetId)?.updatedAt,
        clickedAt
      )
    case 'RA17':
      // Browsing the library has no substantive outcome to verify.
      return false
  }
}

// The target is gone (deleted, or a unit finished elsewhere) and the snapshot
// saw the whole list, so "not found" really means gone. An engineering fact,
// never read as the user's preference.
export function isTargetMissing(instance: Pick<ClickedInstance, 'ruleId' | 'targetId'>, snapshot: EngineSnapshot) {
  const { targetId } = instance
  if (!targetId) return false
  const coverage = snapshot.coverage

  switch (instance.ruleId) {
    case 'RA03':
      return !coverage?.projectsTruncated && !snapshot.projects.some((project) => project.id === targetId)
    case 'RA15':
      return !coverage?.guidesTruncated && !snapshot.guides.some((guide) => guide.id === targetId)
    case 'RA04':
    case 'RA07':
    case 'RA09':
      return !coverage?.unitsTruncated && !snapshot.units.some((unit) => unit.id === targetId)
    default:
      return false
  }
}

export function reconcileClickedInstance(
  instance: ClickedInstance,
  snapshot: EngineSnapshot
): CompletionVerdict {
  if (isGoalMet(instance, snapshot)) {
    return 'completed'
  }

  if (snapshot.coverage && isTargetMissing(instance, snapshot)) {
    return 'invalidated'
  }

  const ageMs = Date.parse(snapshot.now) - Date.parse(instance.clickedAt)

  return ageMs > COMPLETION_WINDOW_DAYS * 24 * 60 * 60 * 1000 ? 'expired' : 'pending'
}
