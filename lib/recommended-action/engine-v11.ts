import {
  FAMILY_PENALTY,
  MAX_PER_RULE,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_TTL_HOURS,
  V11,
  V11_RULESET_VERSION,
  V11_WEIGHTS,
  type EngineOptions,
} from './config'
import {
  buildUserContext,
  daysSince,
  intentFit,
  momentumFrom,
  personaLeansTo,
  projectAbandonmentRisk,
  unitMomentum,
  type UserContext,
} from './context'
import { isActionTypeSupported } from './dispatch'
import {
  buildTrace,
  getRecommendationKey,
  isActiveUntil,
  suppressionReason,
  toDTO,
  type ScoredCandidate,
} from './engine'
import { resolvePersona } from './persona'
import { RULES, STEP_LABELS } from './rules'
import type {
  Candidate,
  EngineDiagnostics,
  EngineResult,
  EngineSnapshot,
  ProgressStepKey,
  RejectionReason,
  RuleId,
  SuppressionState,
} from './types'

// V1.1 contextual ranking (nba-v1.1.0). Same rules, keys and suppression as
// V1; what changes is who is eligible and how candidates are compared:
//
//   gate (lifecycle, abandonment, real outcome) → score on six factors →
//   protected tier only for genuinely time-critical work → one sort.
//
// No absolute bands: an empty project can't outrank active painting just by
// being "activation". Every accept/reject carries a reason for the trace.

type Parts = {
  actionValue: number
  momentum: number
  feasibility: number
  intentFit: number
  timing: number
  novelty: number
}

type Accepted = {
  parts: Parts
  penalties: Record<string, number>
  isProtected: boolean
  lastMeaningfulAt: string | null
  deadline: string | null
  copy?: Partial<Pick<Candidate, 'title' | 'description' | 'eyebrow'>>
}

type Assessment = { gate: RejectionReason } | Accepted

type RankedCandidate = ScoredCandidate & { lastMeaningfulAt: string | null; deadline: string | null }

type Env = {
  snapshot: EngineSnapshot
  context: UserContext
  nowMs: number
  suppression: SuppressionState
  strongestUnitId: string | null
}

// How directly the CTA lands on the action (preselected sheet vs a landing page).
const FEASIBILITY: Record<RuleId, number> = {
  RA01: 90,
  RA02: 85,
  RA03: 85,
  RA04: 80,
  RA07: 85,
  RA09: 95,
  RA10: 90,
  RA13: 70,
  RA15: 85,
  RA17: 60,
}

// A finished stage this close to the end makes another session high value.
const NEAR_COMPLETE_STAGES: readonly ProgressStepKey[] = ['fine_details', 'base_rim']

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function weighted(parts: Parts) {
  return (
    (V11_WEIGHTS.actionValue * parts.actionValue +
      V11_WEIGHTS.momentum * parts.momentum +
      V11_WEIGHTS.feasibility * parts.feasibility +
      V11_WEIGHTS.intentFit * parts.intentFit +
      V11_WEIGHTS.timing * parts.timing +
      V11_WEIGHTS.novelty * parts.novelty) /
    100
  )
}

function novelty(key: string, suppression: SuppressionState) {
  return Math.max(40, 100 - 20 * (suppression.ignoredImpressions?.[key] ?? 0))
}

// Only a real, user-set deadline creates urgency.
function deadlineTiming(deadline: string | null | undefined, nowMs: number) {
  if (!deadline) return null
  const daysLeft = (Date.parse(deadline) - nowMs) / (24 * 60 * 60 * 1000)
  if (!Number.isFinite(daysLeft)) return null
  return daysLeft < 0 ? 60 : daysLeft <= 14 ? 80 : null
}

function isSettled(lifecycle: UserContext['lifecycle']) {
  return lifecycle === 'established' || lifecycle === 'lapsed'
}

// The unit a returning painter worked on most, for a frictionless resume.
function findStrongestUnit(snapshot: EngineSnapshot) {
  const activity = snapshot.activity
  if (!activity) return null

  return (
    snapshot.units
      .filter((unit) => unit.status === 'active' && unit.lastDoneStepKey !== 'done')
      .map((unit) => ({ unit, stats: activity.units[unit.id] }))
      .filter((entry) => entry.stats && entry.stats.sessionsTotal > 0)
      .sort(
        (first, second) =>
          second.stats!.sessionsTotal - first.stats!.sessionsTotal ||
          (second.stats!.lastSessionAt ?? '').localeCompare(first.stats!.lastSessionAt ?? '') ||
          first.unit.id.localeCompare(second.unit.id)
      )[0]?.unit.id ?? null
  )
}

function assess(candidate: Candidate, key: string, env: Env): Assessment {
  const { snapshot, context, nowMs } = env
  const lifecycle = context.lifecycle
  const activity = snapshot.activity ?? null
  const base = {
    feasibility: FEASIBILITY[candidate.ruleId],
    intentFit: intentFit(context, candidate.family),
    novelty: novelty(key, env.suppression),
  }
  const unit = candidate.targetType === 'unit'
    ? snapshot.units.find((entry) => entry.id === candidate.targetId)
    : undefined

  switch (candidate.ruleId) {
    case 'RA01':
    case 'RA02': {
      // "First" anything is for people who haven't started; never housekeeping
      // for someone already using the app.
      const allowed = candidate.ruleId === 'RA01' ? lifecycle === 'new' : lifecycle === 'new' || lifecycle === 'activated'
      if (!allowed) return { gate: 'lifecycle_gate' }

      return {
        parts: { ...base, actionValue: lifecycle === 'new' ? 92 : 75, momentum: 0, timing: 30 },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: null,
        deadline: null,
      }
    }

    case 'RA03': {
      const project = snapshot.projects.find((entry) => entry.id === candidate.targetId)
      if (!project) return { gate: 'action_unavailable' }

      const ageDays = daysSince(project.createdAt, nowMs) ?? 0
      const fresh = ageDays <= V11.freshProjectDays
      // Featured = the user chose it as current work.
      const eligible = project.isFeatured || lifecycle === 'new' || (lifecycle === 'activated' && fresh)
      if (!eligible) return { gate: 'lifecycle_gate' }

      const { risk } = projectAbandonmentRisk(project, snapshot, nowMs)
      // A brand-new user's only project is still their first step, however
      // old; everyone else's likely-abandoned project is left alone.
      if (!project.isFeatured && lifecycle !== 'new' && risk >= V11.abandonExcludeAt) {
        return { gate: 'abandoned_project' }
      }

      const abandonment =
        risk >= V11.abandonExcludeAt ? 40 : risk >= V11.abandonDemoteAt ? 10 + Math.round(((risk - 40) / 29) * 15) : 0
      const lastChild = activity?.projects[project.id]?.lastChildActivityAt ?? null

      return {
        parts: {
          ...base,
          actionValue: lifecycle === 'new' || lifecycle === 'activated' ? 88 : 70,
          // Creating it recently is fresh intent, but not proof of work.
          momentum: momentumFrom(lastChild ?? (fresh ? project.createdAt : null), 0, nowMs, Boolean(lastChild)),
          timing: ageDays <= 2 ? 70 : 30,
        },
        penalties: abandonment ? { abandonment } : {},
        isProtected:
          (lifecycle === 'new' || lifecycle === 'activated') &&
          ageDays * 24 <= V11.inProgressFlowHours,
        lastMeaningfulAt: lastChild ?? project.createdAt,
        deadline: null,
      }
    }

    case 'RA04': {
      if (!unit) return { gate: 'action_unavailable' }
      const momentum = unitMomentum(unit, snapshot, nowMs)
      if (momentum === 0 && !unit.isFeatured && isSettled(lifecycle)) return { gate: 'stale_target' }

      return {
        parts: {
          ...base,
          actionValue: snapshot.units.some((entry) => entry.hasAnyImage) ? 45 : 55,
          momentum,
          timing: 20,
        },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: activity?.units[unit.id]?.lastActivityAt ?? null,
        deadline: unit.deadline ?? null,
      }
    }

    case 'RA07': {
      if (!unit) return { gate: 'action_unavailable' }
      const momentum = unitMomentum(unit, snapshot, nowMs)
      const stats = activity?.units[unit.id]
      const timing = deadlineTiming(unit.deadline, nowMs) ?? 30

      if (!unit.hasRecordedProgress) {
        if (momentum === 0 && !unit.isFeatured && isSettled(lifecycle)) return { gate: 'stale_target' }

        return {
          parts: { ...base, actionValue: momentum > 0 ? 62 : 55, momentum, timing },
          penalties: {},
          isProtected: false,
          lastMeaningfulAt: stats?.lastActivityAt ?? null,
          deadline: unit.deadline ?? null,
        }
      }

      // A check-in is only worth it when the user has painted since the last
      // recorded stage change. A quiet week alone is not a reason.
      const lastSession = stats?.lastSessionAt ?? (activity ? null : unit.lastSessionAt)
      const sessionDays = daysSince(lastSession, nowMs)
      const stageAt = stats?.lastStageChangeAt ?? null
      const plausible =
        sessionDays !== undefined &&
        sessionDays <= V11.checkInSessionDays &&
        (!stageAt || Date.parse(lastSession!) > Date.parse(stageAt))

      if (!plausible) return { gate: 'no_real_outcome' }

      const stageLabel = unit.lastDoneStepKey ? STEP_LABELS[unit.lastDoneStepKey] : 'none yet'

      return {
        parts: { ...base, actionValue: 72, momentum, timing },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: stats?.lastActivityAt ?? lastSession,
        deadline: unit.deadline ?? null,
        copy: {
          title: `Update ${unit.name}'s progress`,
          description: `Last recorded stage: ${stageLabel}. You have painted since, so mark anything you finished.`,
        },
      }
    }

    case 'RA09': {
      if (!unit) return { gate: 'action_unavailable' }
      const momentum = unitMomentum(unit, snapshot, nowMs)
      const stats = activity?.units[unit.id]
      const isStrongest = lifecycle === 'lapsed' && unit.id === env.strongestUnitId
      const nearComplete =
        momentum >= 45 && unit.lastDoneStepKey !== null && NEAR_COMPLETE_STAGES.includes(unit.lastDoneStepKey)
      const sessionDays = daysSince(stats?.lastSessionAt ?? unit.lastSessionAt, nowMs)
      const habitTiming = sessionDays === undefined ? 30 : sessionDays < 1 ? 20 : sessionDays <= 14 ? 50 : 30

      return {
        parts: {
          ...base,
          actionValue:
            (momentum >= 45 ? 85 : momentum > 0 ? 78 : isStrongest ? 80 : 62) + (nearComplete ? 8 : 0),
          momentum,
          timing: deadlineTiming(unit.deadline, nowMs) ?? habitTiming,
        },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: stats?.lastActivityAt ?? unit.lastSessionAt,
        deadline: unit.deadline ?? null,
        ...(isStrongest
          ? {
              copy: {
                eyebrow: 'Welcome Back',
                description: 'Pick up right where you left off. Nothing to catch up on first.',
              },
            }
          : {}),
      }
    }

    case 'RA10': {
      const running = snapshot.activeSession?.id === candidate.targetId ? snapshot.activeSession : null
      const ended = snapshot.latestEndedSession?.id === candidate.targetId ? snapshot.latestEndedSession : null
      const session = running ?? ended
      if (!session) return { gate: 'action_unavailable' }

      // A few seconds of accidental timer isn't a session worth logging.
      if (!running && (session.durationSeconds ?? Infinity) < V11.minSessionMinutes * 60) {
        return { gate: 'no_real_outcome' }
      }

      return {
        parts: { ...base, actionValue: 95, momentum: 80, timing: running ? 100 : 90 },
        penalties: {},
        isProtected: true,
        lastMeaningfulAt: session.endedAt ?? session.startedAt,
        deadline: null,
      }
    }

    case 'RA13': {
      const owned = snapshot.totals.ownedPaints
      const paintFocused = context.familyEvidence.paints >= V11.intentSignalAt
      const organizerStart = lifecycle === 'new' && personaLeansTo(context.persona, 'paints')
      // A collector with paints never gets "start your collection".
      if (owned > 0 && !paintFocused && !organizerStart) return { gate: 'lifecycle_gate' }

      return {
        parts: {
          ...base,
          actionValue: organizerStart ? 85 : paintFocused ? 60 : 35,
          momentum: Math.round(context.familyEvidence.paints / 2),
          timing: 20,
        },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: null,
        deadline: null,
      }
    }

    case 'RA15': {
      const guide = snapshot.guides.find((entry) => entry.id === candidate.targetId)
      if (!guide) return { gate: 'action_unavailable' }

      const stats = activity?.guides[guide.id]
      const lastEdit = stats?.lastEditAt ?? guide.updatedAt
      const editDays = daysSince(lastEdit, nowMs) ?? Infinity

      return {
        parts: {
          ...base,
          actionValue: stats?.contentCount === 0 ? 45 : editDays <= V11.recentGuideEditDays ? 85 : 68,
          momentum: momentumFrom(lastEdit, 0, nowMs, Boolean(stats)),
          timing: 30,
        },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: lastEdit,
        deadline: null,
      }
    }

    case 'RA17':
      return {
        parts: { ...base, actionValue: 20, momentum: 0, timing: 10 },
        penalties: {},
        isProtected: false,
        lastMeaningfulAt: null,
        deadline: null,
      }
  }
}

function compareRanked(first: RankedCandidate, second: RankedCandidate) {
  return (
    Number(Boolean(second.isProtected)) - Number(Boolean(first.isProtected)) ||
    second.score - first.score ||
    (second.lastMeaningfulAt ?? '').localeCompare(first.lastMeaningfulAt ?? '') ||
    (first.deadline ?? '￿').localeCompare(second.deadline ?? '￿') ||
    first.ruleId.localeCompare(second.ruleId) ||
    first.recommendationKey.localeCompare(second.recommendationKey)
  )
}

export function evaluateRecommendationsV11(
  snapshot: EngineSnapshot,
  suppression: SuppressionState = {},
  options: EngineOptions = {}
): EngineResult {
  const nowMs = Date.parse(snapshot.now)
  const persona = resolvePersona(snapshot)
  const context = options.context ?? buildUserContext(snapshot)
  const disabled = new Set(options.disabledRules ?? [])
  const env: Env = { snapshot, context, nowMs, suppression, strongestUnitId: findStrongestUnit(snapshot) }
  const rejected: EngineDiagnostics['rejected'] = []
  const diagnostics: EngineDiagnostics = {
    rulesetVersion: V11_RULESET_VERSION,
    persona,
    evaluatedRules: 0,
    candidateCount: 0,
    rejected,
    fallbackServed: false,
  }

  const accepted: RankedCandidate[] = []
  let fallback: RankedCandidate | null = null

  for (const rule of RULES) {
    if (disabled.has(rule.id)) {
      rejected.push({ ruleId: rule.id, recommendationKey: null, reason: 'rule_disabled' })
      continue
    }

    diagnostics.evaluatedRules += 1

    for (const candidate of rule.evaluate({ snapshot, persona, nowMs, revision: 'v1.1' })) {
      diagnostics.candidateCount += 1
      const recommendationKey = getRecommendationKey(candidate)
      const reject = (reason: RejectionReason) =>
        rejected.push({ ruleId: rule.id, recommendationKey, reason, targetId: candidate.targetId })

      if (!isActionTypeSupported(candidate.actionType)) {
        reject('action_unavailable')
        continue
      }

      const suppressed = suppressionReason(recommendationKey, suppression, nowMs)
      if (suppressed) {
        reject(suppressed)
        continue
      }

      const assessment = assess(candidate, recommendationKey, env)
      if ('gate' in assessment) {
        reject(assessment.gate)
        continue
      }

      const penalties = { ...assessment.penalties }
      if (isActiveUntil(suppression.familyPenaltyUntil?.[candidate.family], nowMs)) {
        penalties.not_interested = FAMILY_PENALTY
      }

      const penaltyTotal = Object.values(penalties).reduce((sum, value) => sum + value, 0)
      const score = clamp(weighted(assessment.parts) - penaltyTotal)
      const ranked: RankedCandidate = {
        ...candidate,
        ...assessment.copy,
        recommendationKey,
        effectiveBand: 0,
        score,
        parts: assessment.parts,
        penalties,
        isProtected: assessment.isProtected,
        lastMeaningfulAt: assessment.lastMeaningfulAt,
        deadline: assessment.deadline,
      }

      if (candidate.ruleId === 'RA17') {
        fallback ??= ranked
        continue
      }

      // Fewer suggestions beat irrelevant ones.
      if (score < V11.minScore && !assessment.isProtected) {
        reject('low_value')
        continue
      }

      accepted.push(ranked)
    }
  }

  accepted.sort(compareRanked)

  // One card per action on a target; "continue painting" and "update its
  // stage" on the same unit are different actions and may both appear.
  const seen = new Set<string>()
  const perRule = new Map<string, number>()
  const selected: RankedCandidate[] = []

  for (const candidate of accepted) {
    const intent = `${candidate.actionType}:${candidate.targetId ?? 'none'}`
    if (seen.has(intent)) {
      rejected.push({
        ruleId: candidate.ruleId,
        recommendationKey: candidate.recommendationKey,
        reason: 'duplicate_intent',
        targetId: candidate.targetId,
      })
      continue
    }

    const ruleCount = perRule.get(candidate.ruleId) ?? 0
    if (ruleCount >= MAX_PER_RULE) continue

    seen.add(intent)
    perRule.set(candidate.ruleId, ruleCount + 1)
    selected.push(candidate)
  }

  const rotation: RankedCandidate[] = selected.slice(0, fallback ? MAX_RECOMMENDATIONS - 1 : MAX_RECOMMENDATIONS)
  if (fallback) rotation.push(fallback)

  diagnostics.fallbackServed = rotation[0]?.ruleId === 'RA17'
  diagnostics.trace = buildTrace('v1.1', V11_RULESET_VERSION, rotation, rejected)

  const expiresAt = new Date(nowMs + RECOMMENDATION_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const quoteSeed = `${snapshot.userId}:${snapshot.now.slice(0, 10)}`
  const dtoOptions = { ...options, context }

  return {
    recommendations: rotation.map((candidate) =>
      toDTO(candidate, persona, quoteSeed, expiresAt, dtoOptions, 'v1.1', V11_RULESET_VERSION)
    ),
    diagnostics,
  }
}
