import {
  FAMILY_PENALTY,
  MAX_PER_RULE,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_TTL_HOURS,
  RULESET_VERSION,
  SCORE_WEIGHTS,
  type EngineOptions,
} from './config'
import { isActionTypeSupported } from './dispatch'
import { getPersonaBonus, personaAllowsFamily, resolvePersona } from './persona'
import { pickQuote } from './quotes'
import { RULES } from './rules'
import {
  PRIORITY_BANDS,
  type Candidate,
  type EngineDiagnostics,
  type EngineResult,
  type EngineSnapshot,
  type RankingRevision,
  type RankingTrace,
  type RecommendedActionDTO,
  type RejectionReason,
  type ResolvedPersona,
  type RuleId,
  type SuppressionState,
  type TraceEntry,
} from './types'

export type ScoredCandidate = Candidate & {
  recommendationKey: string
  effectiveBand: number
  score: number
  parts?: Record<string, number>
  penalties?: Record<string, number>
  isProtected?: boolean
}

export function getRecommendationKey(candidate: Candidate) {
  return `${candidate.ruleId}:${candidate.targetId ?? 'none'}:${candidate.contextFingerprint}`
}

function weightedScore(candidate: Candidate) {
  const { components } = candidate

  return Math.round(
    (SCORE_WEIGHTS.contextualRelevance * components.contextualRelevance +
      SCORE_WEIGHTS.oneTapFeasibility * components.oneTapFeasibility +
      SCORE_WEIGHTS.activationOrUrgency * components.activationOrUrgency +
      SCORE_WEIGHTS.meaningfulDepth * components.meaningfulDepth +
      SCORE_WEIGHTS.novelty * components.novelty) /
      100
  )
}

export function isActiveUntil(until: string | undefined, nowMs: number) {
  return Boolean(until) && Date.parse(until as string) > nowMs
}

// Suppression semantics shared by every ranking revision (unchanged in V1.1).
export function suppressionReason(
  recommendationKey: string,
  suppression: SuppressionState,
  nowMs: number
): RejectionReason | null {
  if (suppression.excludeKeys?.includes(recommendationKey)) return 'excluded_this_visit'
  if (suppression.dismissedKeys?.includes(recommendationKey)) return 'dismissed'
  if (suppression.completedKeys?.includes(recommendationKey)) return 'completed'
  if (isActiveUntil(suppression.snoozedUntil?.[recommendationKey], nowMs)) return 'snoozed'
  if (isActiveUntil(suppression.cooldownUntil?.[recommendationKey], nowMs)) return 'cooldown'
  return null
}

function toTraceEntry(candidate: ScoredCandidate): TraceEntry {
  return {
    ruleId: candidate.ruleId,
    recommendationKey: candidate.recommendationKey,
    targetType: candidate.targetType,
    targetId: candidate.targetId,
    score: candidate.score,
    ...(candidate.isProtected ? { protected: true } : {}),
    ...(candidate.parts ? { parts: candidate.parts } : {}),
    ...(candidate.penalties && Object.keys(candidate.penalties).length ? { penalties: candidate.penalties } : {}),
  }
}

// Ids and numbers only: this is what the traces table stores.
export function buildTrace(
  rankingRevision: RankingRevision,
  rulesetVersion: string,
  selected: ScoredCandidate[],
  rejected: { ruleId: RuleId; recommendationKey: string | null; reason: RejectionReason; targetId?: string | null }[]
): RankingTrace {
  const rejections: RankingTrace['rejections'] = {}
  for (const entry of rejected) rejections[entry.reason] = (rejections[entry.reason] ?? 0) + 1

  return {
    rankingRevision,
    rulesetVersion,
    winner: selected[0] ? toTraceEntry(selected[0]) : null,
    alternatives: selected.slice(1, 3).map(toTraceEntry),
    rejections,
    rejected: rejected.slice(0, 25).map((entry) => {
      const target = entry.targetId ?? entry.recommendationKey?.split(':')[1] ?? null
      return { ruleId: entry.ruleId, reason: entry.reason, targetId: target === 'none' ? null : target }
    }),
  }
}

// Work outside the user's chosen starting family drops one band, so a guide
// creator's draft is not buried under "add a unit" prompts. Once the user's
// own activity points at that family, it competes normally.
function getEffectiveBand(candidate: Candidate, persona: ResolvedPersona) {
  if (candidate.band === PRIORITY_BANDS.fallback) {
    return candidate.band
  }

  return personaAllowsFamily(persona, candidate.family) ? candidate.band : candidate.band + 1
}

function compareCandidates(first: ScoredCandidate, second: ScoredCandidate) {
  return (
    first.effectiveBand - second.effectiveBand ||
    second.score - first.score ||
    second.components.activationOrUrgency - first.components.activationOrUrgency ||
    (second.lastRelevantChangeAt ?? '').localeCompare(first.lastRelevantChangeAt ?? '') ||
    first.ruleId.localeCompare(second.ruleId) ||
    first.recommendationKey.localeCompare(second.recommendationKey)
  )
}

export function evaluateRecommendations(
  snapshot: EngineSnapshot,
  suppression: SuppressionState = {},
  options: EngineOptions = {}
): EngineResult {
  const nowMs = Date.parse(snapshot.now)
  const persona = resolvePersona(snapshot)
  const disabled = new Set(options.disabledRules ?? [])
  const diagnostics: EngineDiagnostics = {
    rulesetVersion: RULESET_VERSION,
    persona,
    evaluatedRules: 0,
    candidateCount: 0,
    rejected: [],
    fallbackServed: false,
  }

  const eligible: ScoredCandidate[] = []

  for (const rule of RULES) {
    if (disabled.has(rule.id)) {
      diagnostics.rejected.push({ ruleId: rule.id, recommendationKey: null, reason: 'rule_disabled' })
      continue
    }

    diagnostics.evaluatedRules += 1

    for (const candidate of rule.evaluate({ snapshot, persona, nowMs })) {
      diagnostics.candidateCount += 1

      if (!isActionTypeSupported(candidate.actionType)) {
        diagnostics.rejected.push({ ruleId: rule.id, recommendationKey: null, reason: 'rule_disabled' })
        continue
      }

      const recommendationKey = getRecommendationKey(candidate)
      const reason = suppressionReason(recommendationKey, suppression, nowMs)

      if (reason) {
        diagnostics.rejected.push({ ruleId: rule.id, recommendationKey, reason })
        continue
      }

      const familyPenalty = isActiveUntil(suppression.familyPenaltyUntil?.[candidate.family], nowMs)
        ? FAMILY_PENALTY
        : 0
      const score = Math.max(
        0,
        Math.min(
          100,
          weightedScore(candidate) + getPersonaBonus(persona, candidate.family) - familyPenalty
        )
      )

      eligible.push({
        ...candidate,
        recommendationKey,
        effectiveBand: getEffectiveBand(candidate, persona),
        score,
      })
    }
  }

  eligible.sort(compareCandidates)

  const seenIntents = new Set<string>()
  const perRule = new Map<string, number>()
  const ranked: ScoredCandidate[] = []
  let fallback: ScoredCandidate | null = null

  for (const candidate of eligible) {
    if (candidate.band === PRIORITY_BANDS.fallback) {
      fallback ??= candidate
      continue
    }

    if (seenIntents.has(candidate.intentKey)) {
      diagnostics.rejected.push({
        ruleId: candidate.ruleId,
        recommendationKey: candidate.recommendationKey,
        reason: 'duplicate_intent',
      })
      continue
    }

    const ruleCount = perRule.get(candidate.ruleId) ?? 0

    // Over the per-rule cap: left out of this rotation, not rejected.
    if (ruleCount >= MAX_PER_RULE) {
      continue
    }

    seenIntents.add(candidate.intentKey)
    perRule.set(candidate.ruleId, ruleCount + 1)
    ranked.push(candidate)
  }

  // Keep one slot for the fallback so "Show another" always ends somewhere
  // useful rather than on an empty card.
  const selected = ranked.slice(0, fallback ? MAX_RECOMMENDATIONS - 1 : MAX_RECOMMENDATIONS)

  if (fallback) {
    selected.push(fallback)
  }

  diagnostics.fallbackServed = selected.length > 0 && selected[0].band === PRIORITY_BANDS.fallback
  diagnostics.trace = buildTrace('v1', RULESET_VERSION, selected, diagnostics.rejected)

  const expiresAt = new Date(nowMs + RECOMMENDATION_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const quoteSeed = `${snapshot.userId}:${snapshot.now.slice(0, 10)}`

  return {
    recommendations: selected.map((candidate) =>
      toDTO(candidate, persona, quoteSeed, expiresAt, options, 'v1', RULESET_VERSION)
    ),
    diagnostics,
  }
}

export function toDTO(
  candidate: ScoredCandidate,
  persona: ResolvedPersona,
  quoteSeed: string,
  expiresAt: string,
  options: EngineOptions,
  rankingRevision: RankingRevision,
  rulesetVersion: string
): RecommendedActionDTO {
  const quote = pickQuote(candidate.ruleId, candidate.quoteContext, quoteSeed)
  const actionTargetId = candidate.actionTargetId ?? candidate.targetId ?? undefined

  return {
    recommendationKey: candidate.recommendationKey,
    ruleId: candidate.ruleId,
    ruleVersion: candidate.ruleVersion,
    rulesetVersion,
    rankingRevision,
    ...(options.context
      ? {
          lifecycle: options.context.lifecycle,
          observedIntent: options.context.intent,
          dataConfidence: options.context.confidence,
        }
      : {}),
    ...(options.experiment ? { experimentAssignment: options.experiment } : {}),
    persona: persona.persona,
    personaSource: persona.source,
    family: candidate.family,
    targetType: candidate.targetType,
    title: candidate.title,
    description: candidate.description,
    eyebrow: candidate.eyebrow,
    quote: quote.text,
    quoteTemplateId: quote.id,
    image: candidate.image,
    primary: {
      type: candidate.actionType,
      ...(actionTargetId ? { targetId: actionTargetId } : {}),
      ...(candidate.context ? { context: candidate.context } : {}),
      label: candidate.ctaLabel,
    },
    score: candidate.score,
    expiresAt,
  }
}
