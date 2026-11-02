import { fingerprint } from './config'
import { personaAllowsFamily } from './persona'
import {
  PRIORITY_BANDS,
  type Candidate,
  type EngineSnapshot,
  type ProgressStepKey,
  type RankingRevision,
  type ResolvedPersona,
  type RuleId,
  type SnapshotUnit,
} from './types'

// Each rule reads the snapshot and returns zero or more candidates. Rules
// never touch the database and never invent state: a missing record means
// "not recorded", and the copy says so.
export type RuleContext = {
  snapshot: EngineSnapshot
  persona: ResolvedPersona
  nowMs: number
  // v1.1 asks some rules for every plausible target and gates them itself.
  revision?: RankingRevision
}

export type RuleDefinition = {
  id: RuleId
  version: number
  description: string
  evaluate: (context: RuleContext) => Candidate[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export const STEP_LABELS: Record<ProgressStepKey, string> = {
  assembled: 'Assembled',
  primed: 'Primed',
  initial_paints: 'Initial Paints',
  fine_details: 'Fine Details',
  base_rim: 'Base & Rim',
  done: 'Done',
}

// A unit is "in play" when it's on the active bench or the shelf next to it.
// Pile-of-shame and complete units are left alone by unit-work rules.
// Progress steps carry no timestamp, so "the user updated progress" is
// detected as this fingerprint changing (completion.ts uses it too).
export function unitProgressFingerprint(unit: SnapshotUnit) {
  return fingerprint([unit.id, unit.lastDoneStepKey, unit.hasRecordedProgress])
}

function isWorkableUnit(unit: SnapshotUnit) {
  return unit.status === 'active' || unit.status === 'bench'
}

function wholeDaysSince(iso: string | null, nowMs: number) {
  if (!iso) {
    return undefined
  }

  const elapsed = nowMs - Date.parse(iso)

  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / DAY_MS)) : undefined
}

function latest(...values: (string | null | undefined)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
}

// Featured first, then most recently touched. Stable for equal inputs.
function orderUnits(units: SnapshotUnit[]) {
  return [...units].sort((first, second) => {
    if (first.isFeatured !== second.isFeatured) {
      return first.isFeatured ? -1 : 1
    }

    const firstTouched = latest(first.updatedAt, first.lastSessionAt) ?? ''
    const secondTouched = latest(second.updatedAt, second.lastSessionAt) ?? ''

    return secondTouched.localeCompare(firstTouched) || first.id.localeCompare(second.id)
  })
}

function unitImage(unit: SnapshotUnit) {
  return unit.imageUrl
    ? { url: unit.imageUrl, alt: `Your ${unit.name}`, kind: 'unit' as const }
    : null
}

const RA01: RuleDefinition = {
  id: 'RA01',
  version: 1,
  description: 'No project yet and the user starts in painting.',
  evaluate: ({ snapshot, persona }) => {
    if (snapshot.totals.projects > 0 || !personaAllowsFamily(persona, 'painting')) {
      return []
    }

    return [
      {
        ruleId: 'RA01',
        ruleVersion: 1,
        family: 'painting',
        band: PRIORITY_BANDS.activation,
        actionType: 'CREATE_PROJECT',
        targetType: 'none',
        targetId: null,
        contextFingerprint: fingerprint(['projects', 0]),
        intentKey: 'activation:project',
        lastRelevantChangeAt: null,
        components: {
          contextualRelevance: 90,
          oneTapFeasibility: 90,
          activationOrUrgency: 100,
          meaningfulDepth: 70,
          novelty: 100,
        },
        title: 'Create your first project',
        description: 'Give your miniatures a home so every unit and session has a place to land.',
        eyebrow: 'First Steps',
        ctaLabel: 'Create Project',
        image: null,
        quoteContext: {},
      },
    ]
  },
}

const RA02: RuleDefinition = {
  id: 'RA02',
  version: 1,
  description: 'No authored guide yet and the user starts in guides.',
  evaluate: ({ snapshot, persona }) => {
    if (snapshot.totals.guides > 0 || !personaAllowsFamily(persona, 'guides')) {
      return []
    }

    return [
      {
        ruleId: 'RA02',
        ruleVersion: 1,
        family: 'guides',
        band: PRIORITY_BANDS.activation,
        actionType: 'CREATE_GUIDE',
        targetType: 'none',
        targetId: null,
        contextFingerprint: fingerprint(['guides', 0]),
        intentKey: 'activation:guide',
        lastRelevantChangeAt: null,
        components: {
          contextualRelevance: 85,
          oneTapFeasibility: 80,
          activationOrUrgency: 100,
          meaningfulDepth: 80,
          novelty: 100,
        },
        title: 'Create your first painting guide',
        description: 'Turn a recipe you know by heart into cards other painters can follow.',
        eyebrow: 'First Steps',
        ctaLabel: 'Start a Guide',
        image: null,
        quoteContext: {},
      },
    ]
  },
}

const RA03: RuleDefinition = {
  id: 'RA03',
  version: 1,
  description: 'A project exists with no units in it.',
  evaluate: ({ snapshot }) =>
    snapshot.projects
      .filter((project) => project.unitCount === 0)
      .sort(
        (first, second) =>
          Number(second.isFeatured) - Number(first.isFeatured) ||
          second.updatedAt.localeCompare(first.updatedAt) ||
          first.id.localeCompare(second.id)
      )
      .map((project) => ({
        ruleId: 'RA03' as const,
        ruleVersion: 1,
        family: 'painting' as const,
        band: PRIORITY_BANDS.activation,
        actionType: 'ADD_UNIT' as const,
        targetType: 'project' as const,
        targetId: project.id,
        contextFingerprint: fingerprint([project.id, project.unitCount]),
        intentKey: `project:${project.id}:add-unit`,
        lastRelevantChangeAt: project.updatedAt,
        components: {
          contextualRelevance: 90,
          oneTapFeasibility: 85,
          activationOrUrgency: 95,
          meaningfulDepth: 75,
          novelty: 100,
        },
        title: `Add your first unit to ${project.name}`,
        description: 'Add the models you are working on so you can track them stage by stage.',
        eyebrow: 'First Steps',
        ctaLabel: 'Add a Unit',
        image: project.imageUrl
          ? { url: project.imageUrl, alt: project.name, kind: 'project' as const }
          : null,
        quoteContext: { projectName: project.name },
        context: { projectId: project.id },
      })),
}

const RA04: RuleDefinition = {
  id: 'RA04',
  version: 1,
  description: 'A workable unit has no picture at all.',
  evaluate: ({ snapshot }) => {
    const isFirstPhoto = !snapshot.units.some((unit) => unit.hasAnyImage)

    return orderUnits(snapshot.units.filter((unit) => isWorkableUnit(unit) && !unit.hasAnyImage)).map(
      (unit) => ({
        ruleId: 'RA04' as const,
        ruleVersion: 1,
        family: 'painting' as const,
        band: PRIORITY_BANDS.unitWork,
        actionType: 'ADD_UNIT_IMAGE' as const,
        targetType: 'unit' as const,
        targetId: unit.id,
        contextFingerprint: fingerprint([unit.id, unit.hasAnyImage]),
        intentKey: `unit:${unit.id}:photo`,
        lastRelevantChangeAt: unit.updatedAt,
        components: {
          contextualRelevance: unit.isFeatured ? 85 : 70,
          oneTapFeasibility: 80,
          activationOrUrgency: isFirstPhoto ? 85 : 55,
          meaningfulDepth: 60,
          novelty: 100,
        },
        title: `Add a photo of ${unit.name}`,
        description: 'Capture where it stands today, so you can see how far it comes.',
        eyebrow: 'On the Bench',
        ctaLabel: 'Add Photo',
        image: null,
        quoteContext: { unitName: unit.name },
      })
    )
  },
}

// Stage-check intervals: a unit with logged progress gets a gentle check-in
// only after a week without any recorded change.
const CHECK_IN_AFTER_DAYS = 7

const RA07: RuleDefinition = {
  id: 'RA07',
  version: 1,
  description: 'A workable unit has no recorded stage, or none recorded for a week.',
  evaluate: ({ snapshot, nowMs, revision }) =>
    orderUnits(snapshot.units.filter(isWorkableUnit)).flatMap((unit) => {
      if (snapshot.activeSession?.unitId === unit.id || unit.lastDoneStepKey === 'done') {
        return []
      }

      const lastTouched = latest(unit.updatedAt, unit.lastSessionAt)
      const daysSince = wholeDaysSince(lastTouched, nowMs)
      const isUninitialized = !unit.hasRecordedProgress

      // v1 checks in after a quiet week. v1.1 does the opposite (an update is
      // plausible after recent painting) and decides that in its own gate.
      if (
        revision !== 'v1.1' &&
        !isUninitialized &&
        (daysSince === undefined || daysSince < CHECK_IN_AFTER_DAYS)
      ) {
        return []
      }

      const stageLabel = unit.lastDoneStepKey ? STEP_LABELS[unit.lastDoneStepKey] : undefined

      return [
        {
          ruleId: 'RA07' as const,
          ruleVersion: 1,
          family: 'painting' as const,
          band: PRIORITY_BANDS.unitWork,
          actionType: 'UPDATE_UNIT_PROGRESS' as const,
          targetType: 'unit' as const,
          targetId: unit.id,
          contextFingerprint: unitProgressFingerprint(unit),
          intentKey: `unit:${unit.id}:work`,
          lastRelevantChangeAt: lastTouched,
          components: {
            contextualRelevance: unit.isFeatured ? 90 : 75,
            oneTapFeasibility: 85,
            activationOrUrgency: isUninitialized ? 80 : 50,
            meaningfulDepth: 70,
            novelty: 100,
          },
          title: isUninitialized
            ? `Record ${unit.name}'s current stage`
            : `Check in on ${unit.name}'s progress`,
          description: isUninitialized
            ? 'Mark the stages you have already finished. It takes a few taps.'
            : `Last recorded stage: ${stageLabel ?? 'none yet'}. Update it if you have moved on.`,
          eyebrow: 'Back to the Bench',
          ctaLabel: 'Update Progress',
          image: unitImage(unit),
          quoteContext: { unitName: unit.name, daysSinceRecorded: daysSince, stageLabel },
        },
      ]
    }),
}

const RA09: RuleDefinition = {
  id: 'RA09',
  version: 1,
  description: 'No timer running; an active unit can be painted now.',
  evaluate: ({ snapshot, nowMs }) => {
    if (snapshot.activeSession) {
      return []
    }

    return orderUnits(
      snapshot.units.filter((unit) => unit.status === 'active' && unit.lastDoneStepKey !== 'done')
    ).map((unit) => {
      const hasHistory = Boolean(unit.lastSessionAt) || unit.hasRecordedProgress
      const daysSince = wholeDaysSince(unit.lastSessionAt, nowMs)
      // Most useful a few days after the last session; not the same evening.
      const urgency =
        daysSince === undefined ? 60 : daysSince < 1 ? 35 : daysSince <= 14 ? 75 : 60

      return {
        ruleId: 'RA09' as const,
        ruleVersion: 1,
        family: 'painting' as const,
        band: PRIORITY_BANDS.unitWork,
        actionType: 'START_UNIT_SESSION' as const,
        targetType: 'unit' as const,
        targetId: unit.id,
        contextFingerprint: fingerprint([unit.id, unit.lastSessionAt, unit.lastDoneStepKey]),
        intentKey: `unit:${unit.id}:work`,
        lastRelevantChangeAt: latest(unit.updatedAt, unit.lastSessionAt),
        components: {
          contextualRelevance: unit.isFeatured ? 95 : 80,
          oneTapFeasibility: 95,
          activationOrUrgency: urgency,
          meaningfulDepth: 90,
          novelty: 100,
        },
        title: hasHistory ? `Continue Painting: ${unit.name}` : `Start Painting: ${unit.name}`,
        description: hasHistory
          ? 'Pick up where you left off and move them closer to completion.'
          : 'Start the clock and get the first layer down.',
        eyebrow: 'Back to the Bench',
        ctaLabel: 'Open Unit & Paint',
        image: unitImage(unit),
        quoteContext: {
          unitName: unit.name,
          daysSinceRecorded: daysSince,
          stageLabel: unit.lastDoneStepKey ? STEP_LABELS[unit.lastDoneStepKey] : undefined,
        },
      }
    })
  },
}

// An ended session without notes is worth a nudge only while it's fresh.
const UNLOGGED_SESSION_WINDOW_HOURS = 48

const RA10: RuleDefinition = {
  id: 'RA10',
  version: 1,
  description: 'A timer is running, or a recent session ended without notes.',
  evaluate: ({ snapshot, nowMs }) => {
    const running = snapshot.activeSession
    const ended = snapshot.latestEndedSession
    const session = running ??
      (ended?.endedAt &&
      !ended.hasNotes &&
      nowMs - Date.parse(ended.endedAt) <= UNLOGGED_SESSION_WINDOW_HOURS * 60 * 60 * 1000
        ? ended
        : null)
    const unit = session ? snapshot.units.find((candidate) => candidate.id === session.unitId) : null

    // A session whose unit we can't see can't be deep-linked safely.
    if (!session || !unit) {
      return []
    }

    const isRunning = session === running

    return [
      {
        ruleId: 'RA10',
        ruleVersion: 1,
        family: 'painting',
        band: PRIORITY_BANDS.recovery,
        actionType: 'LOG_UNIT_SESSION',
        targetType: 'session',
        targetId: session.id,
        actionTargetId: unit.id,
        contextFingerprint: fingerprint([session.id, session.endedAt, session.hasNotes]),
        intentKey: `session:${session.id}`,
        lastRelevantChangeAt: session.endedAt ?? session.startedAt,
        components: {
          contextualRelevance: 95,
          oneTapFeasibility: 90,
          activationOrUrgency: isRunning ? 95 : 60,
          meaningfulDepth: 80,
          novelty: 100,
        },
        title: isRunning ? `Finish your session on ${unit.name}` : 'Record your painting session',
        description: isRunning
          ? 'Your painting clock is still running. Stop it and note what you got done.'
          : `Add a quick note about what you did on ${unit.name} while you remember it.`,
        eyebrow: isRunning ? 'Clock Running' : 'Session Ledger',
        ctaLabel: isRunning ? 'Finish Session' : 'Add Session Note',
        image: unitImage(unit),
        quoteContext: { unitName: unit.name },
      },
    ]
  },
}

const RA13: RuleDefinition = {
  id: 'RA13',
  version: 1,
  description: 'Few or no owned paints recorded.',
  evaluate: ({ snapshot, persona }) => {
    const owned = snapshot.totals.ownedPaints
    const isOrganizer = persona.persona === 'organize_hobby'
    // Organizers start here; everyone else only once they have some real
    // work in the app and still no paints at all.
    const eligible = isOrganizer
      ? owned < 5
      : owned === 0 && persona.meaningfulActionCount >= 2

    if (!eligible) {
      return []
    }

    return [
      {
        ruleId: 'RA13',
        ruleVersion: 1,
        family: 'paints',
        band: isOrganizer ? PRIORITY_BANDS.activation : PRIORITY_BANDS.crossFamily,
        actionType: 'SEED_PAINT_COLLECTION',
        targetType: 'none',
        targetId: null,
        contextFingerprint: fingerprint(['owned', owned > 0]),
        intentKey: 'paints:seed',
        lastRelevantChangeAt: null,
        components: {
          contextualRelevance: isOrganizer ? 85 : 60,
          oneTapFeasibility: 75,
          activationOrUrgency: isOrganizer ? 90 : 50,
          meaningfulDepth: 65,
          novelty: 100,
        },
        title: 'Log your essential paints',
        description: 'Mark the paints on your shelf as owned. Even a handful is a start.',
        eyebrow: 'Paint Rack',
        ctaLabel: 'Add My Paints',
        image: null,
        quoteContext: {},
      },
    ]
  },
}

const RA15: RuleDefinition = {
  id: 'RA15',
  version: 1,
  description: 'An authored guide is still a draft.',
  evaluate: ({ snapshot, nowMs }) =>
    snapshot.guides
      .filter((guide) => guide.visibility === 'draft')
      .sort(
        (first, second) =>
          second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id)
      )
      .map((guide) => ({
        ruleId: 'RA15' as const,
        ruleVersion: 1,
        family: 'guides' as const,
        band: PRIORITY_BANDS.recovery,
        actionType: 'CONTINUE_GUIDE' as const,
        targetType: 'guide' as const,
        targetId: guide.id,
        contextFingerprint: fingerprint([guide.id, guide.updatedAt]),
        intentKey: `guide:${guide.id}:continue`,
        lastRelevantChangeAt: guide.updatedAt,
        components: {
          contextualRelevance: 85,
          oneTapFeasibility: 85,
          activationOrUrgency: 70,
          meaningfulDepth: 85,
          novelty: 100,
        },
        title: `Continue “${guide.title}”`,
        description: 'Your draft is waiting. Add the next card while the idea is fresh.',
        eyebrow: 'On the Writing Desk',
        ctaLabel: 'Continue Guide',
        image: guide.imageUrl
          ? { url: guide.imageUrl, alt: guide.title, kind: 'guide' as const }
          : null,
        quoteContext: {
          guideTitle: guide.title,
          daysSinceRecorded: wholeDaysSince(guide.updatedAt, nowMs),
        },
      })),
}

const RA17: RuleDefinition = {
  id: 'RA17',
  version: 1,
  description: 'Fallback: browse public guides.',
  evaluate: () => [
    {
      ruleId: 'RA17',
      ruleVersion: 1,
      family: 'discovery',
      band: PRIORITY_BANDS.fallback,
      actionType: 'DISCOVER_GUIDES',
      targetType: 'none',
      targetId: null,
      contextFingerprint: fingerprint(['discover']),
      intentKey: 'discover',
      lastRelevantChangeAt: null,
      components: {
        contextualRelevance: 40,
        oneTapFeasibility: 90,
        activationOrUrgency: 20,
        meaningfulDepth: 30,
        novelty: 60,
      },
      title: 'Find your next source of inspiration',
      description: 'Browse guides from other painters for a technique to try next.',
      eyebrow: 'The Library',
      ctaLabel: 'Browse Guides',
      image: null,
      quoteContext: {},
    },
  ],
}

// Evaluation order doesn't affect ranking; it only fixes diagnostics order.
export const RULES: readonly RuleDefinition[] = [
  RA01,
  RA02,
  RA03,
  RA04,
  RA07,
  RA09,
  RA10,
  RA13,
  RA15,
  RA17,
]
