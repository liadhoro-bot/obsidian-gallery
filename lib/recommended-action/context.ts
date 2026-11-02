import { V11 } from './config'
import type {
  DataConfidence,
  EngineSnapshot,
  Familiarity,
  FeatureFamily,
  Lifecycle,
  ObservedIntent,
  Persona,
  SnapshotProject,
  SnapshotUnit,
} from './types'

// V1.1 user understanding: lifecycle, observed intent, per-family
// familiarity and data confidence, each derived from durable app writes
// (activity RPC) with the onboarding goal only as a soft prior. Pure; every
// classification carries the reasons that produced it.

const DAY_MS = 24 * 60 * 60 * 1000
const FAMILIES: readonly FeatureFamily[] = ['painting', 'paints', 'guides', 'discovery']

const INTENT_BY_FAMILY: Record<FeatureFamily, ObservedIntent> = {
  painting: 'painting',
  paints: 'paint_collection',
  guides: 'guide_creation',
  discovery: 'guide_discovery',
}

// How strongly each onboarding goal leans toward each family (0..1).
const PERSONA_PRIOR: Record<Persona, Partial<Record<FeatureFamily, number>>> = {
  paint_miniature: { painting: 1 },
  organize_hobby: { painting: 1, paints: 0.6 },
  create_content: { guides: 1 },
  look_around: {},
  unknown: {},
}

export type UserContext = {
  lifecycle: Lifecycle
  confidence: DataConfidence
  intent: ObservedIntent
  // 0..100 behavioural evidence per family over the last 30 days.
  familyEvidence: Record<FeatureFamily, number>
  familiarity: Record<FeatureFamily, Familiarity>
  persona: Persona
  lastMeaningfulAt: string | null
  reasons: string[]
}

export function daysSince(iso: string | null | undefined, nowMs: number) {
  if (!iso) return undefined
  const elapsed = nowMs - Date.parse(iso)
  return Number.isFinite(elapsed) ? Math.max(0, elapsed / DAY_MS) : undefined
}

function latest(...values: (string | null | undefined)[]) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
}

function getPersona(snapshot: EngineSnapshot): Persona {
  return snapshot.onboarding ? snapshot.onboarding.goalKey ?? 'look_around' : 'unknown'
}

function familyEvidenceScore(actions30: number, days30: number, actions7: number) {
  return Math.min(100, 8 * Math.min(actions30, 6) + 10 * Math.min(days30, 4) + (actions7 > 0 ? 12 : 0))
}

function toFamiliarity(lifetime: number): Familiarity {
  return lifetime === 0 ? 'never_tried' : lifetime === 1 ? 'tried_once' : 'repeated_user'
}

function classifyIntent(evidence: Record<FeatureFamily, number>): ObservedIntent {
  const [top, second] = [...FAMILIES].sort((a, b) => evidence[b] - evidence[a] || a.localeCompare(b))

  if (evidence[top] < V11.intentSignalAt) return 'unknown'
  if (evidence[second] >= V11.intentSignalAt && evidence[second] >= evidence[top] * 0.75) return 'mixed'
  return INTENT_BY_FAMILY[top]
}

// Without the activity read we only have durable entities. They prove the user
// did something, never how recently, so confidence is low and lifecycle leans
// conservative (never "new" when real records exist).
function contextFromEntities(snapshot: EngineSnapshot, nowMs: number, persona: Persona): UserContext {
  const { totals } = snapshot
  const substantive = totals.units + totals.guides + totals.sessions + totals.ownedPaints > 0
  const lastMeaningfulAt = latest(
    ...snapshot.units.flatMap((unit) => [unit.lastSessionAt, unit.createdAt]),
    ...snapshot.guides.map((guide) => guide.updatedAt)
  )
  const idleDays = daysSince(lastMeaningfulAt, nowMs)
  const reasons = ['activity read unavailable: entities only']

  let lifecycle: Lifecycle = 'new'
  if (substantive) {
    if (idleDays !== undefined && idleDays > V11.lapsedAfterDays) {
      lifecycle = 'lapsed'
      reasons.push(`last dated work ${Math.floor(idleDays)}d ago`)
    } else if (totals.sessions >= V11.establishedSessions30 || totals.units >= 3) {
      lifecycle = 'established'
      reasons.push(`${totals.sessions} sessions, ${totals.units} units on record`)
    } else {
      lifecycle = 'activated'
      reasons.push('some records, little history')
    }
  } else {
    reasons.push('no units, guides, sessions or paints')
  }

  const rough: Record<FeatureFamily, number> = {
    painting: Math.min(100, 10 * (totals.units + totals.sessions)),
    paints: Math.min(100, totals.ownedPaints > 0 ? 30 + totals.ownedPaints : 0),
    guides: Math.min(100, 25 * totals.guides),
    discovery: Math.min(100, 15 * totals.savedGuides),
  }

  return {
    lifecycle,
    confidence: 'low',
    intent: classifyIntent(rough),
    familyEvidence: rough,
    familiarity: {
      painting: toFamiliarity(totals.units + totals.sessions),
      paints: toFamiliarity(totals.ownedPaints),
      guides: toFamiliarity(totals.guides),
      discovery: toFamiliarity(totals.savedGuides),
    },
    persona,
    lastMeaningfulAt,
    reasons,
  }
}

export function buildUserContext(snapshot: EngineSnapshot): UserContext {
  const nowMs = Date.parse(snapshot.now)
  const persona = getPersona(snapshot)
  const activity = snapshot.activity

  if (!activity) {
    return contextFromEntities(snapshot, nowMs, persona)
  }

  const reasons: string[] = []
  const idleDays = daysSince(activity.lastMeaningfulAt, nowMs)
  let lifecycle: Lifecycle

  if (activity.actionsLifetime === 0) {
    lifecycle = 'new'
    reasons.push('no meaningful action yet (an empty project does not count)')
  } else if (idleDays === undefined || idleDays > V11.lapsedAfterDays) {
    lifecycle = 'lapsed'
    reasons.push(`no meaningful action for ${Math.floor(idleDays ?? 0)}d`)
  } else if (
    activity.days30 >= V11.establishedDays30 ||
    (activity.sessions30 >= V11.establishedSessions30 &&
      activity.actions30 - activity.sessions30 >= V11.establishedOtherActions30) ||
    (activity.actionsLifetime >= V11.establishedLifetimeActions &&
      activity.daysLifetime >= V11.establishedLifetimeDays)
  ) {
    lifecycle = 'established'
    reasons.push(
      `${activity.days30} active days and ${activity.sessions30} sessions in 30d; ${activity.actionsLifetime} actions over ${activity.daysLifetime} days`
    )
  } else {
    lifecycle = 'activated'
    reasons.push(`${activity.actionsLifetime} meaningful actions, not yet a habit`)
  }

  const familyEvidence = Object.fromEntries(
    FAMILIES.map((family) => {
      const stats = activity.families[family]
      return [family, familyEvidenceScore(stats.actions30, stats.days30, stats.actions7)]
    })
  ) as Record<FeatureFamily, number>

  const truncated = Boolean(
    snapshot.coverage?.unitsTruncated || snapshot.coverage?.projectsTruncated || snapshot.coverage?.guidesTruncated
  )
  if (truncated) reasons.push('snapshot truncated by row caps')

  return {
    lifecycle,
    confidence: truncated ? 'medium' : 'high',
    intent: classifyIntent(familyEvidence),
    familyEvidence,
    familiarity: Object.fromEntries(
      FAMILIES.map((family) => [family, toFamiliarity(activity.families[family].lifetime)])
    ) as Record<FeatureFamily, Familiarity>,
    persona,
    lastMeaningfulAt: activity.lastMeaningfulAt,
    reasons,
  }
}

// Behaviour first; the onboarding goal only matters while evidence is thin.
export function intentFit(context: UserContext, family: FeatureFamily) {
  const priorWeight = V11.priorWeight[context.lifecycle]
  const prior = 100 * (PERSONA_PRIOR[context.persona][family] ?? 0)
  return Math.round((1 - priorWeight) * context.familyEvidence[family] + priorWeight * prior)
}

export function personaLeansTo(persona: Persona, family: FeatureFamily) {
  return (PERSONA_PRIOR[persona][family] ?? 0) > 0
}

// Spec §3 momentum curve. Untrusted timestamps (no activity read) are capped.
export function momentumFrom(lastAt: string | null | undefined, actions30: number, nowMs: number, trusted: boolean) {
  const days = daysSince(lastAt, nowMs)
  if (days === undefined) return 0

  const base = days <= 3 ? 80 : days <= 7 ? 65 : days <= 14 ? 45 : days <= 30 ? 20 : 0
  const value = base > 0 ? Math.min(100, base + Math.min(20, 5 * actions30)) : 0

  return trusted ? value : Math.min(V11.untrustedMomentumCap, value)
}

export function unitMomentum(unit: SnapshotUnit, snapshot: EngineSnapshot, nowMs: number) {
  const activity = snapshot.activity
  if (!activity) return momentumFrom(unit.lastSessionAt, 0, nowMs, false)

  const stats = activity.units[unit.id]
  return stats ? momentumFrom(stats.lastActivityAt, stats.actions30, nowMs, true) : 0
}

const PROVISIONAL_NAME = /^\s*(test|testing|asdf|qwe|tmp|temp|untitled|new project|xx+|foo|demo)\b/i

export type AbandonmentAssessment = { risk: number; signals: string[] }

// Spec §4. Never deletes or renames anything; a provisional-looking name is
// worth 10 points at most and can't exclude a project on its own.
export function projectAbandonmentRisk(
  project: SnapshotProject,
  snapshot: EngineSnapshot,
  nowMs: number
): AbandonmentAssessment {
  const signals: string[] = []
  const ageDays = daysSince(project.createdAt, nowMs) ?? 0
  const lastChild = snapshot.activity?.projects[project.id]?.lastChildActivityAt ?? null
  const childDays = daysSince(lastChild, nowMs)
  const recentChild = childDays !== undefined && childDays <= 30
  let risk = 0

  if (project.unitCount === 0 && ageDays > 30) {
    risk += 35
    signals.push('empty_over_30d')
  }
  if (!lastChild && ageDays > 14) {
    risk += 25
    signals.push('no_activity_since_creation')
  }
  if (snapshot.activity && !recentChild) {
    risk += 20
    signals.push('no_activity_30d')
  }
  if (!project.isFeatured) {
    risk += 10
    signals.push('not_featured')
  }
  if (PROVISIONAL_NAME.test(project.name)) {
    risk += 10
    signals.push('provisional_name')
  }
  if (project.isFeatured) {
    risk -= 50
    signals.push('featured')
  }
  if (recentChild) {
    risk -= 50
    signals.push('recent_child_activity')
  }

  return { risk: Math.max(0, Math.min(100, risk)), signals }
}
