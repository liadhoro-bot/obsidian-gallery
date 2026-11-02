import type { UserContext } from './context'
import type { ExperimentAssignment, RankingRevision, RuleId, ScoreComponents } from './types'

// Bump whenever rule logic, weights or quotes change. Logged on every
// recommendation so outcomes can be compared across versions.
export const RULESET_VERSION = 'ra-2026-11-01.1'

// Spec §5.2 initial hypotheses, as integer percentages (sum 100).
export const SCORE_WEIGHTS: Record<keyof ScoreComponents, number> = {
  contextualRelevance: 30,
  oneTapFeasibility: 25,
  activationOrUrgency: 20,
  meaningfulDepth: 15,
  novelty: 10,
}

// "Not interested" lowers the whole family softly for 14 days.
export const FAMILY_PENALTY = 15
export const FAMILY_PENALTY_DAYS = 14
export const SNOOZE_DAYS = 7
export const RECOMMENDATION_TTL_HOURS = 24
// How many ranked recommendations the card gets for "Show another".
export const MAX_RECOMMENDATIONS = 5
// Keeps one rule from filling the rotation (e.g. five "add a photo" cards).
export const MAX_PER_RULE = 2

// V1.1 contextual ranking (docs/recommended-action/v1.1-audit-and-plan.md).
// A revision of V1, not a new product version. Every number here is a
// starting hypothesis; change them only through a reviewed revision bump.
export const V11_RULESET_VERSION = 'nba-v1.1.0'

export const V11_WEIGHTS = {
  actionValue: 30,
  momentum: 25,
  feasibility: 15,
  intentFit: 12,
  timing: 10,
  novelty: 8,
} as const

export const V11 = {
  // Lifecycle (spec §2)
  establishedDays30: 3,
  establishedSessions30: 2,
  establishedOtherActions30: 1,
  establishedLifetimeActions: 5,
  establishedLifetimeDays: 3,
  lapsedAfterDays: 30,
  // RA03: an empty project counts as fresh intent this long after creation.
  freshProjectDays: 14,
  // A project created this recently is an in-progress flow (protected).
  inProgressFlowHours: 2,
  // Sessions shorter than this are not worth logging (matches the RPC).
  minSessionMinutes: 5,
  // Below this final score a candidate is dropped rather than shown.
  minScore: 25,
  // Abandonment (spec §4)
  abandonExcludeAt: 70,
  abandonDemoteAt: 40,
  // Intent: family evidence counted as a real signal from this score.
  intentSignalAt: 30,
  // Draft guides count as "recent" creator work within this window.
  recentGuideEditDays: 14,
  // A session-backed stage check-in is plausible this long after the session.
  checkInSessionDays: 14,
  // Momentum cap when only generic timestamps exist (spec §3).
  untrustedMomentumCap: 45,
  // Persona prior weight by lifecycle: strong while new, fades with evidence.
  priorWeight: { new: 0.7, activated: 0.4, established: 0.2, lapsed: 0.2 },
} as const

// Shadow mode: the served revision decides the card; the other is computed
// on the same snapshot and only traced. Default stays 'v1' until the shadow
// review signs v1.1 off.
export function getServedRankingRevision(
  env: Record<string, string | undefined> = process.env
): RankingRevision {
  return env.RECOMMENDED_ACTION_RANKING === 'v1.1' ? 'v1.1' : 'v1'
}

export type EngineOptions = {
  // Rules switched off by flag or circuit breaker.
  disabledRules?: RuleId[]
  experiment?: ExperimentAssignment
  // Computed once per evaluation (context.ts) and stamped on every DTO.
  context?: UserContext
}

// Kill switch. Anything but an explicit 'true' keeps the existing dashboard.
export function isRecommendedActionEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return env.RECOMMENDED_ACTION_ENABLED === 'true'
}

// Controlled rollout: when RECOMMENDED_ACTION_USER_IDS is set (comma
// separated), only those accounts get the card. Unset = everyone, once the
// kill switch is on.
export function isRecommendedActionEnabledFor(
  userId: string,
  env: Record<string, string | undefined> = process.env
) {
  if (!isRecommendedActionEnabled(env)) return false

  const allowlist = (env.RECOMMENDED_ACTION_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  return allowlist.length === 0 || allowlist.includes(userId)
}

// FNV-1a, 32-bit. Deterministic and synchronous: used for fingerprints,
// experiment buckets and quote rotation. Not a security primitive.
export function stableHash(input: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export function fingerprint(parts: (string | number | boolean | null | undefined)[]) {
  return stableHash(parts.map((part) => String(part ?? '')).join('|')).toString(36)
}

export type ExperimentDefinition = {
  id: string
  // Variant name -> share of users, in whole percent (sum 100).
  allocation: Record<string, number>
}

// Server-side bucketing: the same user always lands in the same variant for a
// given experiment id, with no network call and nothing for the client to
// disagree with. Changing the id reshuffles everyone, so treat it as a new
// experiment.
export function assignExperiment(
  userId: string,
  experiment: ExperimentDefinition
): ExperimentAssignment {
  const bucket = stableHash(`${experiment.id}:${userId}`) % 100
  let ceiling = 0

  for (const [variant, share] of Object.entries(experiment.allocation)) {
    ceiling += share

    if (bucket < ceiling) {
      return { experimentId: experiment.id, variant }
    }
  }

  const variants = Object.keys(experiment.allocation)

  return { experimentId: experiment.id, variant: variants[variants.length - 1] }
}
