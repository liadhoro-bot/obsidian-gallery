import { FAMILY_PENALTY_DAYS, SNOOZE_DAYS } from './config'
import type { FeatureFamily, RuleId, SuppressionState } from './types'

// Pure helpers behind the card's feedback buttons and impression tracking.
// The server (service.ts / the events route) applies them to stored rows.

const RULE_IDS: readonly RuleId[] = [
  'RA01', 'RA02', 'RA03', 'RA04', 'RA07', 'RA09', 'RA10', 'RA13', 'RA15', 'RA17',
]
const FAMILIES: readonly FeatureFamily[] = ['painting', 'paints', 'guides', 'discovery']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DAY_MS = 24 * 60 * 60 * 1000
// Impressions closer together than this are the same visit.
export const IMPRESSION_VISIT_GAP_MS = 30 * 60 * 1000
// Spec §5.3: three ignored impressions across separate visits → 7-day cooldown.
export const IGNORED_IMPRESSION_LIMIT = 3
export const COOLDOWN_DAYS = 7

export type ParsedRecommendationKey = {
  ruleId: RuleId
  targetId: string | null
  contextHash: string
}

// Keys are built by engine.getRecommendationKey. The server derives rule and
// target from the key itself rather than trusting separate client fields.
export function parseRecommendationKey(key: unknown): ParsedRecommendationKey | null {
  if (typeof key !== 'string' || key.length > 120) return null

  const [ruleId, target, contextHash, ...rest] = key.split(':')

  if (rest.length || !RULE_IDS.includes(ruleId as RuleId) || !/^[0-9a-z]{1,16}$/.test(contextHash ?? '')) {
    return null
  }

  if (target !== 'none' && !UUID_PATTERN.test(target ?? '')) return null

  return { ruleId: ruleId as RuleId, targetId: target === 'none' ? null : target, contextHash }
}

export function isFeatureFamily(value: unknown): value is FeatureFamily {
  return FAMILIES.includes(value as FeatureFamily)
}

export type StoredInstance = {
  recommendation_key: string
  status: 'served' | 'clicked' | 'completed' | 'dismissed' | 'snoozed' | 'expired' | 'invalidated'
  snoozed_until: string | null
  cooldown_until: string | null
  ignored_impressions?: number | null
}

export function buildSuppression(
  instances: StoredInstance[],
  familyPenalties: Record<string, unknown> | null | undefined,
  nowMs: number
): SuppressionState {
  const suppression: Required<
    Pick<SuppressionState, 'snoozedUntil' | 'dismissedKeys' | 'completedKeys' | 'cooldownUntil' | 'familyPenaltyUntil'>
  > = {
    snoozedUntil: {},
    dismissedKeys: [],
    completedKeys: [],
    cooldownUntil: {},
    familyPenaltyUntil: {},
  }

  const ignoredImpressions: Record<string, number> = {}

  for (const row of instances) {
    if (row.status === 'dismissed') suppression.dismissedKeys.push(row.recommendation_key)
    if (row.status === 'completed') suppression.completedKeys.push(row.recommendation_key)
    if (row.status === 'snoozed' && row.snoozed_until) {
      suppression.snoozedUntil[row.recommendation_key] = row.snoozed_until
    }
    if (row.cooldown_until) suppression.cooldownUntil[row.recommendation_key] = row.cooldown_until
    if (row.ignored_impressions) {
      ignoredImpressions[row.recommendation_key] = row.ignored_impressions
    }
  }

  for (const [family, until] of Object.entries(familyPenalties ?? {})) {
    if (isFeatureFamily(family) && typeof until === 'string' && Date.parse(until) > nowMs) {
      suppression.familyPenaltyUntil[family] = until
    }
  }

  return { ...suppression, ignoredImpressions }
}

export type ImpressionState = {
  first_impression_at: string | null
  last_impression_at: string | null
  ignored_impressions: number
  cooldown_until: string | null
  clicked_at: string | null
}

// Returns the new impression state, or null when this impression belongs to
// a visit already counted.
export function nextImpressionState(
  current: ImpressionState | null,
  nowMs: number
): ImpressionState | null {
  const now = new Date(nowMs).toISOString()
  const last = current?.last_impression_at ? Date.parse(current.last_impression_at) : null

  if (last !== null && nowMs - last < IMPRESSION_VISIT_GAP_MS) {
    return null
  }

  // A click resets "ignored": the user engaged with it.
  const ignored = current?.clicked_at ? 0 : (current?.ignored_impressions ?? 0) + 1
  const coolsDown = ignored >= IGNORED_IMPRESSION_LIMIT

  return {
    first_impression_at: current?.first_impression_at ?? now,
    last_impression_at: now,
    ignored_impressions: coolsDown ? 0 : ignored,
    cooldown_until: coolsDown
      ? new Date(nowMs + COOLDOWN_DAYS * DAY_MS).toISOString()
      : (current?.cooldown_until ?? null),
    clicked_at: current?.clicked_at ?? null,
  }
}

export function snoozeUntil(nowMs: number) {
  return new Date(nowMs + SNOOZE_DAYS * DAY_MS).toISOString()
}

export function withFamilyPenalty(
  penalties: Record<string, unknown> | null | undefined,
  family: FeatureFamily,
  nowMs: number
) {
  return { ...(penalties ?? {}), [family]: new Date(nowMs + FAMILY_PENALTY_DAYS * DAY_MS).toISOString() }
}
