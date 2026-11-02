import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignExperiment,
  isRecommendedActionEnabled,
  stableHash,
} from '../lib/recommended-action/config'
import { resolveActionDestination } from '../lib/recommended-action/dispatch'
import { evaluateRecommendations } from '../lib/recommended-action/engine'
import { getPersonaBonus, resolvePersona } from '../lib/recommended-action/persona'
import { getQuoteTemplateIds, pickQuote } from '../lib/recommended-action/quotes'
import { summarizeUnitProgress } from '../lib/recommended-action/snapshot'
import type {
  EngineSnapshot,
  Persona,
  SnapshotGuide,
  SnapshotProject,
  SnapshotSession,
  SnapshotUnit,
} from '../lib/recommended-action/types'

const NOW = '2026-11-01T12:00:00.000Z'
const DAY = 24 * 60 * 60 * 1000

function id(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function daysAgo(days: number) {
  return new Date(Date.parse(NOW) - days * DAY).toISOString()
}

function hoursAgo(hours: number) {
  return new Date(Date.parse(NOW) - hours * 60 * 60 * 1000).toISOString()
}

function project(overrides: Partial<SnapshotProject> = {}): SnapshotProject {
  return {
    id: id(100),
    name: 'Silver Tower',
    imageUrl: null,
    unitCount: 0,
    isFeatured: false,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(2),
    ...overrides,
  }
}

function unit(overrides: Partial<SnapshotUnit> = {}): SnapshotUnit {
  return {
    id: id(200),
    name: 'Tomb Guard',
    status: 'active',
    isFeatured: true,
    imageUrl: 'https://example.test/tomb-guard.webp',
    hasAnyImage: true,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(3),
    lastSessionAt: daysAgo(3),
    lastDoneStepKey: 'primed',
    hasRecordedProgress: true,
    projectIds: [id(100)],
    ...overrides,
  }
}

function guide(overrides: Partial<SnapshotGuide> = {}): SnapshotGuide {
  return {
    id: id(300),
    title: 'Verdigris in Five Steps',
    visibility: 'draft',
    imageUrl: 'https://example.test/verdigris.webp',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
    ...overrides,
  }
}

function session(overrides: Partial<SnapshotSession> = {}): SnapshotSession {
  return {
    id: id(400),
    unitId: id(200),
    startedAt: hoursAgo(1),
    endedAt: null,
    hasNotes: false,
    ...overrides,
  }
}

function snapshot(
  persona: Persona | null,
  overrides: Partial<Omit<EngineSnapshot, 'totals'>> & {
    totals?: Partial<EngineSnapshot['totals']>
  } = {}
): EngineSnapshot {
  const projects = overrides.projects ?? []
  const units = overrides.units ?? []
  const guides = overrides.guides ?? []

  return {
    userId: id(1),
    now: NOW,
    onboarding:
      persona === null
        ? null
        : { goalKey: persona, experienceLevel: 'know_basics', startedAt: daysAgo(30) },
    activeSession: null,
    latestEndedSession: null,
    ...overrides,
    projects,
    units,
    guides,
    totals: {
      projects: projects.length,
      units: units.length,
      guides: guides.length,
      sessions: 0,
      ownedPaints: 0,
      savedGuides: 0,
      ...overrides.totals,
    },
  }
}

function ruleIds(input: EngineSnapshot, suppression = {}) {
  return evaluateRecommendations(input, suppression).recommendations.map((item) => item.ruleId)
}

// A user with everything set up and nothing outstanding.
function settledPainter() {
  return snapshot('paint_miniature', {
    projects: [project({ unitCount: 1 })],
    units: [unit({ status: 'complete', lastDoneStepKey: 'done' })],
    guides: [guide({ visibility: 'public' })],
    totals: { sessions: 12, ownedPaints: 40 },
  })
}

test('paint_miniature with nothing yet: create a project, never a guide', () => {
  const ids = ruleIds(snapshot('paint_miniature'))

  assert.equal(ids[0], 'RA01')
  assert.ok(!ids.includes('RA02'))
})

test('create_content with nothing yet: create a guide, never a project', () => {
  const ids = ruleIds(snapshot('create_content'))

  assert.equal(ids[0], 'RA02')
  assert.ok(!ids.includes('RA01'))
})

test('project without units: add a unit with the project preselected', () => {
  const result = evaluateRecommendations(
    snapshot('organize_hobby', { projects: [project()] })
  ).recommendations
  const top = result[0]

  assert.equal(top.ruleId, 'RA03')
  assert.equal(top.primary.type, 'ADD_UNIT')
  assert.equal(top.primary.targetId, id(100))
  assert.deepEqual(resolveActionDestination(top.primary.type, top.primary.targetId), {
    kind: 'navigate',
    href: `/projects/${id(100)}?tab=units`,
  })
  // Organizers also get the paint seed in rotation, but after the unit.
  assert.ok(result.some((item) => item.ruleId === 'RA13'))
})

test('unit with no picture at all: add a photo of it', () => {
  const result = evaluateRecommendations(
    snapshot('paint_miniature', {
      projects: [project({ unitCount: 1 })],
      units: [unit({ imageUrl: null, hasAnyImage: false })],
    })
  ).recommendations
  const photo = result.find((item) => item.ruleId === 'RA04')

  assert.ok(photo)
  assert.equal(photo.title, 'Add a photo of Tomb Guard')
  assert.equal(photo.image, null)
  assert.equal(
    resolveActionDestination(photo.primary.type, photo.primary.targetId).kind,
    'navigate'
  )
})

test('unit at Fine Details untouched for 10 days: check in, never "set up" again', () => {
  const input = snapshot('paint_miniature', {
    projects: [project({ unitCount: 1 })],
    units: [
      unit({
        lastDoneStepKey: 'fine_details',
        updatedAt: daysAgo(10),
        lastSessionAt: daysAgo(10),
      }),
    ],
    totals: { sessions: 5 },
  })
  const result = evaluateRecommendations(input)
  const unitWork = result.recommendations.filter(
    (item) => item.ruleId === 'RA07' || item.ruleId === 'RA09'
  )

  // Progress check-in and "continue painting" share one intent per unit.
  assert.equal(unitWork.length, 1)
  assert.ok(
    result.diagnostics.rejected.some((rejection) => rejection.reason === 'duplicate_intent')
  )

  const progressOnly = evaluateRecommendations(input, {}, { disabledRules: ['RA09'] })
  const checkIn = progressOnly.recommendations.find((item) => item.ruleId === 'RA07')

  assert.ok(checkIn)
  assert.equal(checkIn.title, "Check in on Tomb Guard's progress")
  assert.match(checkIn.description, /Last recorded stage: Fine Details/)
})

test('unit with no recorded stage: record its current stage', () => {
  const result = evaluateRecommendations(
    snapshot('paint_miniature', {
      projects: [project({ unitCount: 1 })],
      units: [unit({ lastDoneStepKey: null, hasRecordedProgress: false, lastSessionAt: null })],
    }),
    {},
    { disabledRules: ['RA09'] }
  ).recommendations

  assert.equal(result[0].ruleId, 'RA07')
  assert.equal(result[0].title, "Record Tomb Guard's current stage")
})

test('running timer: finish and log it, never start a second one', () => {
  const result = evaluateRecommendations(
    snapshot('paint_miniature', {
      projects: [project({ unitCount: 1 })],
      units: [unit()],
      activeSession: session(),
      totals: { sessions: 3 },
    })
  ).recommendations

  assert.equal(result[0].ruleId, 'RA10')
  assert.equal(result[0].title, 'Finish your session on Tomb Guard')
  assert.equal(result[0].primary.targetId, id(200))
  assert.ok(!result.some((item) => item.ruleId === 'RA09'))
  assert.deepEqual(resolveActionDestination(result[0].primary.type, result[0].primary.targetId), {
    kind: 'navigate',
    href: `/units/${id(200)}?tab=paint`,
  })
})

test('recent session without notes is offered for logging only while fresh', () => {
  const base = {
    projects: [project({ unitCount: 1 })],
    units: [unit()],
    totals: { sessions: 3 },
  }
  const fresh = ruleIds(
    snapshot('paint_miniature', {
      ...base,
      latestEndedSession: session({ startedAt: hoursAgo(5), endedAt: hoursAgo(4) }),
    })
  )
  const stale = ruleIds(
    snapshot('paint_miniature', {
      ...base,
      latestEndedSession: session({ startedAt: daysAgo(3), endedAt: daysAgo(3) }),
    })
  )
  const noted = ruleIds(
    snapshot('paint_miniature', {
      ...base,
      latestEndedSession: session({ endedAt: hoursAgo(4), hasNotes: true }),
    })
  )

  assert.equal(fresh[0], 'RA10')
  assert.ok(!stale.includes('RA10'))
  assert.ok(!noted.includes('RA10'))
})

test('creator with a draft: the draft outranks unrelated painting prompts', () => {
  const ids = ruleIds(
    snapshot('create_content', {
      projects: [project()],
      guides: [guide()],
    })
  )

  assert.equal(ids[0], 'RA15')
  assert.ok(ids.indexOf('RA15') < ids.indexOf('RA03'))
  assert.ok(!ids.includes('RA02'))
})

test('organizer with work but no paints gets the paint seed', () => {
  const result = evaluateRecommendations(
    snapshot('organize_hobby', {
      projects: [project({ unitCount: 1 })],
      units: [unit()],
      totals: { sessions: 2 },
    })
  ).recommendations
  const seed = result.find((item) => item.ruleId === 'RA13')

  assert.ok(seed)
  assert.equal(resolveActionDestination(seed.primary.type).kind, 'navigate')
})

test('painters only see the paint seed once they have real work and zero paints', () => {
  const newcomer = ruleIds(snapshot('paint_miniature'))
  const working = ruleIds(
    snapshot('paint_miniature', {
      projects: [project({ unitCount: 1 })],
      units: [unit()],
      totals: { sessions: 2 },
    })
  )

  assert.ok(!newcomer.includes('RA13'))
  assert.ok(working.includes('RA13'))
})

test('snooze hides the exact recommendation until it expires', () => {
  const input = snapshot('paint_miniature')
  const [top] = evaluateRecommendations(input).recommendations
  const key = top.recommendationKey

  assert.notEqual(
    ruleIds(input, { snoozedUntil: { [key]: daysAgo(-7) } })[0],
    'RA01'
  )
  assert.equal(ruleIds(input, { snoozedUntil: { [key]: daysAgo(1) } })[0], 'RA01')
})

test('a material change to the target retires an old snooze', () => {
  const before = snapshot('paint_miniature', {
    projects: [project({ unitCount: 1 })],
    units: [unit({ lastDoneStepKey: null, hasRecordedProgress: false, lastSessionAt: null })],
  })
  const options = { disabledRules: ['RA09' as const] }
  const [stagePrompt] = evaluateRecommendations(before, {}, options).recommendations
  const snoozed = { snoozedUntil: { [stagePrompt.recommendationKey]: daysAgo(-7) } }

  assert.ok(!evaluateRecommendations(before, snoozed, options).recommendations.some((item) => item.ruleId === 'RA07'))

  // The user records Primed, then nothing for 8 days: a new check-in is fair.
  const after = snapshot('paint_miniature', {
    projects: [project({ unitCount: 1 })],
    units: [
      unit({
        lastDoneStepKey: 'primed',
        hasRecordedProgress: true,
        updatedAt: daysAgo(8),
        lastSessionAt: daysAgo(8),
      }),
    ],
  })

  assert.ok(evaluateRecommendations(after, snoozed, options).recommendations.some((item) => item.ruleId === 'RA07'))
})

test('not interested drops the instance and softly lowers its family', () => {
  const input = snapshot('look_around', {
    projects: [project({ unitCount: 1 }), project({ id: id(101), name: 'Hammerhal', unitCount: 0 })],
    units: [unit({ imageUrl: null, hasAnyImage: false })],
    guides: [guide()],
  })
  const first = evaluateRecommendations(input).recommendations
  const dismissedKey = first[0].recommendationKey
  const afterDismiss = evaluateRecommendations(input, { dismissedKeys: [dismissedKey] })

  assert.ok(!afterDismiss.recommendations.some((item) => item.recommendationKey === dismissedKey))
  assert.ok(
    afterDismiss.diagnostics.rejected.some(
      (rejection) => rejection.recommendationKey === dismissedKey && rejection.reason === 'dismissed'
    )
  )

  const penalized = evaluateRecommendations(input, {
    familyPenaltyUntil: { guides: daysAgo(-14) },
  }).recommendations.find((item) => item.ruleId === 'RA15')
  const unpenalized = first.find((item) => item.ruleId === 'RA15')

  assert.ok(penalized && unpenalized)
  assert.ok(penalized.score < unpenalized.score)
})

test('show another walks distinct candidates and ends on the fallback, then nothing', () => {
  const input = snapshot('paint_miniature', {
    projects: [project({ unitCount: 1 })],
    units: [unit({ imageUrl: null, hasAnyImage: false, lastDoneStepKey: null, hasRecordedProgress: false })],
    totals: { sessions: 2 },
  })
  const seen: string[] = []

  for (let step = 0; step < 20; step += 1) {
    const [next] = evaluateRecommendations(input, { excludeKeys: seen }).recommendations

    if (!next) {
      break
    }

    assert.ok(!seen.includes(next.recommendationKey))
    seen.push(next.recommendationKey)
  }

  assert.ok(seen.length >= 3)
  assert.match(seen.at(-1) ?? '', /^RA17:/)
  assert.equal(evaluateRecommendations(input, { excludeKeys: seen }).recommendations.length, 0)
})

test('nothing outstanding: honest fallback only', () => {
  const result = evaluateRecommendations(settledPainter())

  assert.deepEqual(
    result.recommendations.map((item) => item.ruleId),
    ['RA17']
  )
  assert.equal(result.diagnostics.fallbackServed, true)
  assert.equal(result.recommendations[0].image, null)
})

test('pile and complete units are never prompted for unit work', () => {
  const ids = ruleIds(
    snapshot('paint_miniature', {
      projects: [project({ unitCount: 2 })],
      units: [
        unit({ status: 'pile', imageUrl: null, hasAnyImage: false, hasRecordedProgress: false }),
        unit({ id: id(201), status: 'complete', lastDoneStepKey: 'done', imageUrl: null, hasAnyImage: false }),
      ],
      totals: { ownedPaints: 20 },
    })
  )

  assert.deepEqual(ids, ['RA17'])
})

test('look_around persona is inferred from activity', () => {
  const resolved = resolvePersona(
    snapshot('look_around', { guides: [guide({ visibility: 'public' })] })
  )

  assert.equal(resolved.persona, 'look_around')
  assert.equal(resolved.source, 'inferred')
  assert.equal(resolved.primaryFamily, 'guides')

  const unknown = resolvePersona(snapshot(null))

  assert.equal(unknown.persona, 'unknown')
  assert.equal(unknown.source, 'default')
  assert.equal(ruleIds(snapshot(null))[0], 'RA01')
})

test('persona bonus decays after two meaningful actions and yields to behaviour', () => {
  const early = resolvePersona(snapshot('create_content'))
  const later = resolvePersona(snapshot('create_content', { guides: [guide()], totals: { sessions: 1 } }))
  const contradicted = resolvePersona(
    snapshot('create_content', {
      projects: [project({ unitCount: 3 })],
      units: [unit(), unit({ id: id(201) }), unit({ id: id(202) })],
      totals: { sessions: 6 },
    })
  )

  assert.equal(getPersonaBonus(early, 'guides'), 12)
  assert.equal(getPersonaBonus(later, 'guides'), 6)
  assert.equal(contradicted.observedFamily, 'painting')
  assert.equal(getPersonaBonus(contradicted, 'guides'), 0)
  assert.equal(getPersonaBonus(contradicted, 'painting'), 6)
})

test('ranking is deterministic regardless of input order', () => {
  const units = [
    unit({ imageUrl: null, hasAnyImage: false, isFeatured: false }),
    unit({ id: id(201), name: 'Ushabti', imageUrl: null, hasAnyImage: false, isFeatured: false, updatedAt: daysAgo(1) }),
    unit({ id: id(202), name: 'Skeleton Horde', isFeatured: false, lastDoneStepKey: null, hasRecordedProgress: false }),
  ]
  const forward = evaluateRecommendations(
    snapshot('paint_miniature', { projects: [project({ unitCount: 3 })], units })
  )
  const reversed = evaluateRecommendations(
    snapshot('paint_miniature', { projects: [project({ unitCount: 3 })], units: [...units].reverse() })
  )

  assert.deepEqual(forward, reversed)
  // At most two cards per rule in one rotation.
  const counts = new Map<string, number>()
  for (const item of forward.recommendations) {
    counts.set(item.ruleId, (counts.get(item.ruleId) ?? 0) + 1)
  }
  assert.ok([...counts.values()].every((count) => count <= 2))
})

test('disabled rules are skipped and logged', () => {
  const result = evaluateRecommendations(snapshot('paint_miniature'), {}, { disabledRules: ['RA01'] })

  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA01'))
  assert.ok(
    result.diagnostics.rejected.some(
      (rejection) => rejection.ruleId === 'RA01' && rejection.reason === 'rule_disabled'
    )
  )
})

test('every DTO carries versioning, persona and a dispatchable action', () => {
  const experiment = assignExperiment(id(1), { id: 'E01', allocation: { control: 25, card: 75 } })
  const result = evaluateRecommendations(
    snapshot('organize_hobby', {
      projects: [project({ unitCount: 1 }), project({ id: id(101), name: 'Hammerhal' })],
      units: [unit({ imageUrl: null, hasAnyImage: false })],
      guides: [guide()],
      totals: { sessions: 2 },
    }),
    {},
    { experiment }
  )

  for (const item of result.recommendations) {
    assert.equal(item.rulesetVersion, result.diagnostics.rulesetVersion)
    assert.equal(item.persona, 'organize_hobby')
    assert.equal(item.personaSource, 'explicit')
    assert.deepEqual(item.experimentAssignment, experiment)
    assert.ok(item.quote.length > 0 && item.quote.length <= 130, item.quote)
    assert.equal(
      resolveActionDestination(item.primary.type, item.primary.targetId).kind,
      'navigate',
      item.ruleId
    )
    assert.ok(Date.parse(item.expiresAt) > Date.parse(NOW))
  }
})

test('quotes never print a zero-day gap and stay stable for a user and day', () => {
  const zero = pickQuote('RA09', { unitName: 'Tomb Guard', daysSinceRecorded: 0 }, 'seed')
  const again = pickQuote('RA09', { unitName: 'Tomb Guard', daysSinceRecorded: 0 }, 'seed')

  assert.doesNotMatch(zero.text, /\b0 days?\b/)
  assert.deepEqual(zero, again)
  assert.equal(pickQuote('RA03', {}, 'seed').id, 'generic.bench')
  assert.equal(new Set(getQuoteTemplateIds()).size, getQuoteTemplateIds().length)
})

test('dispatch only resolves allowlisted types with valid ids', () => {
  assert.deepEqual(resolveActionDestination('ADD_UNIT_IMAGE', 'not-a-uuid'), {
    kind: 'unsupported',
    reason: 'missing_target',
  })
  assert.deepEqual(resolveActionDestination('SCHEDULE_PAINT_SESSION', id(200)), {
    kind: 'unsupported',
    reason: 'not_implemented',
  })
  assert.deepEqual(resolveActionDestination('START_UNIT_SESSION', id(200)), {
    kind: 'navigate',
    href: `/units/${id(200)}?tab=paint&autostart=1`,
  })
})

test('progress summary reads the live table and the legacy one', () => {
  assert.deepEqual(summarizeUnitProgress([]), {
    lastDoneStepKey: null,
    hasRecordedProgress: false,
  })
  assert.deepEqual(
    summarizeUnitProgress([
      { unit_id: 'u', step_key: 'assembled', status: 'pending' },
      { unit_id: 'u', step_key: 'primed', status: 'pending' },
    ]),
    { lastDoneStepKey: null, hasRecordedProgress: false }
  )
  assert.deepEqual(
    summarizeUnitProgress([
      { unit_id: 'u', step_key: 'assembled', status: 'done' },
      { unit_id: 'u', step_key: 'primed', status: 'in_progress' },
    ]),
    { lastDoneStepKey: 'assembled', hasRecordedProgress: true }
  )
  assert.deepEqual(
    summarizeUnitProgress([], [{ unit_id: 'u', stage_key: 'fine_details', is_done: true }]),
    { lastDoneStepKey: 'fine_details', hasRecordedProgress: true }
  )
})

test('experiment buckets are stable and roughly follow the allocation', () => {
  const definition = { id: 'E01', allocation: { control: 30, card: 70 } }
  const first = assignExperiment(id(7), definition)

  assert.deepEqual(assignExperiment(id(7), definition), first)

  let control = 0
  for (let n = 0; n < 2000; n += 1) {
    if (assignExperiment(id(n), definition).variant === 'control') {
      control += 1
    }
  }

  assert.ok(control > 480 && control < 720, String(control))
  assert.equal(stableHash('abc'), stableHash('abc'))
})

test('kill switch is off unless explicitly enabled', () => {
  assert.equal(isRecommendedActionEnabled({}), false)
  assert.equal(isRecommendedActionEnabled({ RECOMMENDED_ACTION_ENABLED: '1' }), false)
  assert.equal(isRecommendedActionEnabled({ RECOMMENDED_ACTION_ENABLED: 'true' }), true)
})
