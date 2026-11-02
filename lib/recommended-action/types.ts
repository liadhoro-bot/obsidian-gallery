// Recommended Action engine: shared types. The engine is pure — it takes an
// EngineSnapshot (loaded server-side by snapshot.ts) plus suppression state and
// returns ranked recommendations. Nothing here touches the database.

// Personas are the onboarding goals exactly as stored in
// user_onboarding_flows.goal_key. 'unknown' = no onboarding row.
export type Persona =
  | 'paint_miniature'
  | 'organize_hobby'
  | 'create_content'
  | 'look_around'
  | 'unknown'

export type PersonaSource = 'explicit' | 'inferred' | 'default'

export type ExperienceLevel =
  | 'just_starting'
  | 'know_basics'
  | 'experienced'
  | 'professional'

export type FeatureFamily = 'painting' | 'paints' | 'guides' | 'discovery'

// Typed allowlist. The card may only dispatch these; payloads never carry
// routes or SQL. Types without a rule yet are listed so later phases extend
// the union rather than invent parallel names.
export type RecommendedActionType =
  | 'CREATE_PROJECT'
  | 'CREATE_GUIDE'
  | 'ADD_UNIT'
  | 'ADD_UNIT_IMAGE'
  | 'ASSIGN_GUIDE_TO_UNIT'
  | 'UPDATE_UNIT_PROGRESS'
  | 'SCHEDULE_PAINT_SESSION'
  | 'START_UNIT_SESSION'
  | 'LOG_UNIT_SESSION'
  | 'SAVE_GUIDE'
  | 'SEED_PAINT_COLLECTION'
  | 'BUILD_UNIT_PALETTE'
  | 'CONTINUE_GUIDE'
  | 'DISCOVER_GUIDES'

export type RuleId =
  | 'RA01'
  | 'RA02'
  | 'RA03'
  | 'RA04'
  | 'RA07'
  | 'RA09'
  | 'RA10'
  | 'RA13'
  | 'RA15'
  | 'RA17'

export type TargetType = 'none' | 'project' | 'unit' | 'guide' | 'session'

// Ordered bands from the spec's priority order. Lower runs first; score only
// orders candidates inside a band.
export const PRIORITY_BANDS = {
  activation: 1,
  recovery: 2,
  unitWork: 3,
  crossFamily: 4,
  fallback: 5,
} as const

export type PriorityBand = (typeof PRIORITY_BANDS)[keyof typeof PRIORITY_BANDS]

// V1.1 user understanding (context.ts). Four independent dimensions rather
// than one persona label.
export type Lifecycle = 'new' | 'activated' | 'established' | 'lapsed'

export type ObservedIntent =
  | 'painting'
  | 'paint_collection'
  | 'guide_creation'
  | 'guide_discovery'
  | 'mixed'
  | 'unknown'

export type DataConfidence = 'high' | 'medium' | 'low'

export type Familiarity = 'never_tried' | 'tried_once' | 'repeated_user'

// Which ranking produced a recommendation. 'v1' is the original band order,
// 'v1.1' the contextual one; the other runs in shadow and is traced.
export type RankingRevision = 'v1' | 'v1.1'

export type UnitStatus = 'complete' | 'active' | 'bench' | 'pile' | 'other'

export type ProgressStepKey =
  | 'assembled'
  | 'primed'
  | 'initial_paints'
  | 'fine_details'
  | 'base_rim'
  | 'done'

export type SnapshotProject = {
  id: string
  name: string
  imageUrl: string | null
  unitCount: number
  isFeatured: boolean
  createdAt: string
  updatedAt: string
}

export type SnapshotUnit = {
  id: string
  name: string
  status: UnitStatus
  isFeatured: boolean
  // Any image of this unit (gallery or units.image_url). Images carry no
  // kind yet, so this means "has at least one picture", nothing more.
  imageUrl: string | null
  hasAnyImage: boolean
  createdAt: string
  updatedAt: string
  lastSessionAt: string | null
  // User-set deadline, if any.
  deadline?: string | null
  // Highest step marked done, or null when no step was ever recorded.
  lastDoneStepKey: ProgressStepKey | null
  // True once any step left 'pending'.
  hasRecordedProgress: boolean
  projectIds: string[]
}

export type SnapshotSession = {
  id: string
  unitId: string
  startedAt: string
  endedAt: string | null
  hasNotes: boolean
  durationSeconds?: number | null
}

export type SnapshotGuide = {
  id: string
  title: string
  visibility: 'draft' | 'private' | 'public'
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type SnapshotOnboarding = {
  goalKey: Persona | null
  experienceLevel: ExperienceLevel | null
  startedAt: string | null
}

// Counts of meaningful actions for one feature family (activity RPC).
export type ActivityFamilyStats = {
  lifetime: number
  actions30: number
  days30: number
  actions7: number
}

export type UnitActivity = {
  lastActivityAt: string | null
  sessions7: number
  sessions30: number
  sessionsTotal: number
  lastSessionAt: string | null
  // Null when the stage changed before stage changes were dated (or never).
  lastStageChangeAt: string | null
  lastPhotoAt: string | null
  actions30: number
  paletteCount: number
  guideLinkCount: number
}

// From recommended_action_activity(): durable app writes only, never
// PostHog. Missing (null) means the function isn't available, which lowers
// confidence; it never means "no activity".
export type ActivitySummary = {
  firstMeaningfulAt: string | null
  lastMeaningfulAt: string | null
  daysLifetime: number
  actionsLifetime: number
  days30: number
  actions30: number
  actions7: number
  sessions30: number
  families: Record<FeatureFamily, ActivityFamilyStats>
  units: Record<string, UnitActivity>
  projects: Record<string, { lastChildActivityAt: string | null }>
  guides: Record<string, { lastEditAt: string | null; contentCount: number }>
}

// Whether the loader saw everything or hit a row cap.
export type SnapshotCoverage = {
  unitsTruncated: boolean
  projectsTruncated: boolean
  guidesTruncated: boolean
}

export type EngineSnapshot = {
  userId: string
  now: string
  onboarding: SnapshotOnboarding | null
  projects: SnapshotProject[]
  // Most recently updated units, capped by the loader. Includes complete units
  // so persona inference can see them; rules filter by status themselves.
  units: SnapshotUnit[]
  totals: {
    projects: number
    units: number
    // Guides the user authored (auto guides excluded).
    guides: number
    sessions: number
    ownedPaints: number
    savedGuides: number
  }
  activeSession: SnapshotSession | null
  latestEndedSession: SnapshotSession | null
  guides: SnapshotGuide[]
  activity?: ActivitySummary | null
  coverage?: SnapshotCoverage
}

// Fatigue / feedback state the engine must respect. Phase 1 callers pass an
// empty object; Phase 2 loads it from recommended_action_* tables.
export type SuppressionState = {
  // recommendationKey -> ISO time the snooze ends
  snoozedUntil?: Record<string, string>
  dismissedKeys?: string[]
  // Instances whose goal was verified; never served again under that key.
  completedKeys?: string[]
  // family -> ISO time the soft penalty ends
  familyPenaltyUntil?: Partial<Record<FeatureFamily, string>>
  // Keys already shown in this visit ("Show another")
  excludeKeys?: string[]
  // recommendationKey -> ISO time an ignored-impression cooldown ends
  cooldownUntil?: Record<string, string>
  // recommendationKey -> impressions on separate visits without a click
  ignoredImpressions?: Record<string, number>
}

export type ScoreComponents = {
  contextualRelevance: number
  oneTapFeasibility: number
  activationOrUrgency: number
  meaningfulDepth: number
  novelty: number
}

export type QuoteContext = {
  unitName?: string
  projectName?: string
  guideTitle?: string
  // Whole days since the last recorded activity on the target, if known.
  daysSinceRecorded?: number
  stageLabel?: string
}

// What a rule emits before gating and ranking.
export type Candidate = {
  ruleId: RuleId
  ruleVersion: number
  family: FeatureFamily
  band: PriorityBand
  actionType: RecommendedActionType
  targetType: TargetType
  targetId: string | null
  // Entity the CTA opens, when it differs from the target (a session's CTA
  // opens its unit). Defaults to targetId.
  actionTargetId?: string
  // Changes whenever the target materially changes, which retires snoozes,
  // dismissals and stale instances for the old state automatically.
  contextFingerprint: string
  // Candidates sharing an intent compete; only the best survives.
  intentKey: string
  // ISO time of the most recent relevant change, for tie-breaks.
  lastRelevantChangeAt: string | null
  components: ScoreComponents
  title: string
  description: string
  eyebrow: string
  ctaLabel: string
  image: RecommendedActionImage | null
  quoteContext: QuoteContext
  context?: Record<string, string>
}

export type RecommendedActionImage = {
  url: string
  alt: string
  kind: 'unit' | 'guide' | 'project'
}

export type ResolvedPersona = {
  persona: Persona
  source: PersonaSource
  version: string
  // Family the persona starts in; may come from activity for look_around.
  primaryFamily: FeatureFamily
  // Family the user's own activity points to, if any.
  observedFamily: FeatureFamily | null
  experienceLevel: ExperienceLevel | null
  meaningfulActionCount: number
}

export type ExperimentAssignment = {
  experimentId: string
  variant: string
}

export type RecommendedActionDTO = {
  recommendationKey: string
  ruleId: RuleId
  ruleVersion: number
  rulesetVersion: string
  experimentAssignment?: ExperimentAssignment
  persona: Persona
  personaSource: PersonaSource
  family: FeatureFamily
  targetType: TargetType
  title: string
  description: string
  eyebrow: string
  quote: string
  quoteTemplateId: string
  image: RecommendedActionImage | null
  primary: {
    type: RecommendedActionType
    targetId?: string
    context?: Record<string, string>
    label: string
  }
  score: number
  expiresAt: string
  rankingRevision?: RankingRevision
  lifecycle?: Lifecycle
  observedIntent?: ObservedIntent
  dataConfidence?: DataConfidence
}

export type RejectionReason =
  | 'snoozed'
  | 'dismissed'
  | 'completed'
  | 'excluded_this_visit'
  | 'cooldown'
  | 'rule_disabled'
  | 'duplicate_intent'
  // V1.1 gates
  | 'lifecycle_gate'
  | 'abandoned_project'
  | 'stale_target'
  | 'no_real_outcome'
  | 'action_unavailable'
  | 'low_value'

export type EngineDiagnostics = {
  rulesetVersion: string
  persona: ResolvedPersona
  evaluatedRules: number
  candidateCount: number
  // recommendationKey is null for rule-level rejections (rule_disabled).
  rejected: { ruleId: RuleId; recommendationKey: string | null; reason: RejectionReason; targetId?: string | null }[]
  fallbackServed: boolean
  trace?: RankingTrace
}

export type TraceEntry = {
  ruleId: RuleId
  recommendationKey: string
  targetType: TargetType
  targetId: string | null
  score: number
  protected?: boolean
  parts?: Record<string, number>
  penalties?: Record<string, number>
}

// What the traces table stores: no names, notes or URLs.
export type RankingTrace = {
  rankingRevision: RankingRevision
  rulesetVersion: string
  winner: TraceEntry | null
  alternatives: TraceEntry[]
  rejections: Partial<Record<RejectionReason, number>>
  rejected: { ruleId: RuleId; reason: RejectionReason; targetId: string | null }[]
}

export type EngineResult = {
  // Best first. Empty only when every candidate, fallback included, was
  // suppressed — the card then says "You're all caught up".
  recommendations: RecommendedActionDTO[]
  diagnostics: EngineDiagnostics
}
