import type {
  EngineSnapshot,
  ExperienceLevel,
  FeatureFamily,
  Persona,
  ResolvedPersona,
} from './types'

export const PERSONA_VERSION = 'persona-v1'

const PERSONAS: readonly Persona[] = [
  'paint_miniature',
  'organize_hobby',
  'create_content',
  'look_around',
]

const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'just_starting',
  'know_basics',
  'experienced',
  'professional',
]

// How strongly each onboarding goal leans toward each family (0..1).
// organize_hobby starts in painting, then paints.
const PERSONA_FAMILY_WEIGHTS: Record<Persona, Partial<Record<FeatureFamily, number>>> = {
  paint_miniature: { painting: 1 },
  organize_hobby: { painting: 1, paints: 0.5 },
  create_content: { guides: 1 },
  look_around: {},
  unknown: {},
}

// Activity needed before the user's own behaviour counts as a signal.
const OBSERVED_FAMILY_THRESHOLD = 2

export function toPersona(value: string | null | undefined): Persona | null {
  return PERSONAS.find((persona) => persona === value) ?? null
}

export function toExperienceLevel(
  value: string | null | undefined
): ExperienceLevel | null {
  return EXPERIENCE_LEVELS.find((level) => level === value) ?? null
}

// Substantive things the user has made or done. Never page views.
export function countMeaningfulActions(snapshot: EngineSnapshot) {
  const { totals } = snapshot

  return (
    totals.projects +
    totals.units +
    totals.guides +
    totals.sessions +
    (totals.ownedPaints > 0 ? 1 : 0) +
    (totals.savedGuides > 0 ? 1 : 0)
  )
}

export function getObservedFamily(snapshot: EngineSnapshot): FeatureFamily | null {
  const { totals } = snapshot
  const activity: [FeatureFamily, number][] = [
    ['painting', totals.units + totals.sessions],
    // A guide is a bigger piece of work than a unit, so it counts double.
    ['guides', totals.guides * 2 + totals.savedGuides],
    ['paints', totals.ownedPaints > 0 ? Math.min(3, Math.ceil(totals.ownedPaints / 10)) : 0],
  ]
  const [family, count] = activity.reduce((best, entry) =>
    entry[1] > best[1] ? entry : best
  )

  return count >= OBSERVED_FAMILY_THRESHOLD ? family : null
}

export function resolvePersona(snapshot: EngineSnapshot): ResolvedPersona {
  const persona: Persona = snapshot.onboarding
    ? snapshot.onboarding.goalKey ?? 'look_around'
    : 'unknown'
  const observedFamily = getObservedFamily(snapshot)
  const isExplicit = persona !== 'look_around' && persona !== 'unknown'
  const explicitFamily = isExplicit ? getPersonaPrimaryFamily(persona) : null

  return {
    persona,
    source: isExplicit ? 'explicit' : observedFamily ? 'inferred' : 'default',
    version: PERSONA_VERSION,
    primaryFamily: explicitFamily ?? observedFamily ?? 'painting',
    observedFamily,
    experienceLevel: snapshot.onboarding?.experienceLevel ?? null,
    meaningfulActionCount: countMeaningfulActions(snapshot),
  }
}

function getPersonaPrimaryFamily(persona: Persona): FeatureFamily | null {
  const weights = PERSONA_FAMILY_WEIGHTS[persona]
  const entries = Object.entries(weights) as [FeatureFamily, number][]

  if (!entries.length) {
    return null
  }

  return entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0]
}

// Spec §5.2: +12 for the persona's family during the first two meaningful
// actions, +6 after; zero once the user's own activity clearly points
// elsewhere. Inferred personas get the smaller bonus from the start.
export function getPersonaBonus(resolved: ResolvedPersona, family: FeatureFamily) {
  const weights =
    resolved.source === 'explicit'
      ? PERSONA_FAMILY_WEIGHTS[resolved.persona]
      : { [resolved.primaryFamily]: 1 }
  const weight = weights[family] ?? 0
  const isEarly = resolved.meaningfulActionCount < 2
  const contradicted =
    resolved.observedFamily !== null &&
    resolved.observedFamily !== resolved.primaryFamily &&
    !isEarly

  if (contradicted) {
    return family === resolved.observedFamily ? 6 : 0
  }

  const base = resolved.source === 'explicit' && isEarly ? 12 : 6

  return Math.round(weight * base)
}

// Families an onboarding goal is allowed to start with. Used by activation
// rules so a guide creator is never pushed into "create a project" first.
// "Look around" and users without onboarding may start anywhere; the persona
// bonus still decides which comes first.
export function personaAllowsFamily(resolved: ResolvedPersona, family: FeatureFamily) {
  if (resolved.source !== 'explicit') {
    return true
  }

  return (
    (PERSONA_FAMILY_WEIGHTS[resolved.persona][family] ?? 0) > 0 ||
    resolved.observedFamily === family
  )
}
