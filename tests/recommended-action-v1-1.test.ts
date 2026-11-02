import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileClickedInstance } from '../lib/recommended-action/completion'
import { buildUserContext, intentFit, projectAbandonmentRisk } from '../lib/recommended-action/context'
import { evaluateRecommendations } from '../lib/recommended-action/engine'
import { evaluateRecommendationsV11 } from '../lib/recommended-action/engine-v11'
import { buildSuppression } from '../lib/recommended-action/feedback'
import { parseActivity, settleOpenSession } from '../lib/recommended-action/snapshot'
import type {
  ActivitySummary,
  EngineSnapshot,
  FeatureFamily,
  Persona,
  SnapshotGuide,
  SnapshotProject,
  SnapshotUnit,
  UnitActivity,
} from '../lib/recommended-action/types'

// nba-v1.1.0 scenario suite (spec §10). Each test pins the winner, the
// follow-ups that matter and the "must never happen" invariant, and checks
// the reason the trace gives.

const NOW = '2026-11-02T12:00:00.000Z'
const NOW_MS = Date.parse(NOW)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ago = (ms: number) => new Date(NOW_MS - ms).toISOString()

const TOMB_GUARD = id(201)
const GAUNT = id(202)
const SKELETONS = id(203)
const KNIGHT = id(204)
const TEST_PROJECT = id(100)
const REAL_PROJECT = id(101)

function families(overrides: Partial<Record<FeatureFamily, Partial<ActivitySummary['families'][FeatureFamily]>>> = {}) {
  const zero = { lifetime: 0, actions30: 0, days30: 0, actions7: 0 }
  return {
    painting: { ...zero, ...overrides.painting },
    paints: { ...zero, ...overrides.paints },
    guides: { ...zero, ...overrides.guides },
    discovery: { ...zero, ...overrides.discovery },
  }
}

function unitStats(overrides: Partial<UnitActivity> = {}): UnitActivity {
  return {
    lastActivityAt: null,
    sessions7: 0,
    sessions30: 0,
    sessionsTotal: 0,
    lastSessionAt: null,
    lastStageChangeAt: null,
    lastPhotoAt: null,
    actions30: 0,
    paletteCount: 0,
    guideLinkCount: 0,
    ...overrides,
  }
}

function activity(overrides: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    firstMeaningfulAt: null,
    lastMeaningfulAt: null,
    daysLifetime: 0,
    actionsLifetime: 0,
    days30: 0,
    actions30: 0,
    actions7: 0,
    sessions30: 0,
    families: families(),
    units: {},
    projects: {},
    guides: {},
    ...overrides,
  }
}

function unit(unitId: string, name: string, overrides: Partial<SnapshotUnit> = {}): SnapshotUnit {
  return {
    id: unitId,
    name,
    status: 'active',
    isFeatured: false,
    imageUrl: 'https://example.test/u.jpg',
    hasAnyImage: true,
    createdAt: ago(90 * DAY),
    updatedAt: ago(60 * DAY),
    lastSessionAt: null,
    lastDoneStepKey: 'primed',
    hasRecordedProgress: true,
    projectIds: [REAL_PROJECT],
    deadline: null,
    ...overrides,
  }
}

function project(projectId: string, name: string, overrides: Partial<SnapshotProject> = {}): SnapshotProject {
  return {
    id: projectId,
    name,
    imageUrl: null,
    unitCount: 0,
    isFeatured: false,
    createdAt: ago(60 * DAY),
    updatedAt: ago(60 * DAY),
    ...overrides,
  }
}

function guide(guideId: string, title: string, overrides: Partial<SnapshotGuide> = {}): SnapshotGuide {
  return {
    id: guideId,
    title,
    visibility: 'draft',
    imageUrl: null,
    createdAt: ago(30 * DAY),
    updatedAt: ago(DAY),
    ...overrides,
  }
}

function snapshot(persona: Persona | null, overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  const base: EngineSnapshot = {
    userId: id(1),
    now: NOW,
    onboarding: persona ? { goalKey: persona, experienceLevel: 'know_basics', startedAt: ago(120 * DAY) } : null,
    projects: [],
    units: [],
    guides: [],
    activeSession: null,
    latestEndedSession: null,
    totals: { projects: 0, units: 0, guides: 0, sessions: 0, ownedPaints: 0, savedGuides: 0 },
    activity: activity(),
    coverage: { unitsTruncated: false, projectsTruncated: false, guidesTruncated: false },
  }
  const merged = { ...base, ...overrides }

  return {
    ...merged,
    totals: {
      ...base.totals,
      projects: merged.projects.length,
      units: merged.units.length,
      guides: merged.guides.length,
      ...overrides.totals,
    },
  }
}

const rules = (result: ReturnType<typeof evaluateRecommendationsV11>) =>
  result.recommendations.map((item) => `${item.ruleId}:${item.primary.targetId ?? item.recommendationKey.split(':')[1]}`)

const rejectionsFor = (result: ReturnType<typeof evaluateRecommendationsV11>, ruleId: string) =>
  result.diagnostics.rejected.filter((entry) => entry.ruleId === ruleId).map((entry) => entry.reason)

// The owner's real case: an established painter with active units, two
// Tomb Guard sessions this week and an untouched 60-day-old "Test project".
function establishedPainter() {
  return snapshot('paint_miniature', {
    projects: [
      project(TEST_PROJECT, 'Test project', { updatedAt: ago(2 * DAY) }),
      project(REAL_PROJECT, 'Warhammer Quest', { unitCount: 4, isFeatured: true }),
    ],
    units: [
      unit(TOMB_GUARD, 'Tomb Guard', { lastSessionAt: ago(DAY), lastDoneStepKey: 'initial_paints' }),
      unit(GAUNT, 'The Gaunt Summoner', { lastSessionAt: ago(20 * DAY) }),
      unit(SKELETONS, 'Skeleton Warriors', { hasRecordedProgress: false, lastDoneStepKey: null }),
      unit(KNIGHT, 'Wight King', { status: 'bench', hasAnyImage: false, imageUrl: null }),
    ],
    totals: { projects: 2, units: 4, guides: 0, sessions: 14, ownedPaints: 25, savedGuides: 0 },
    activity: activity({
      firstMeaningfulAt: ago(200 * DAY),
      lastMeaningfulAt: ago(DAY),
      daysLifetime: 40,
      actionsLifetime: 90,
      days30: 5,
      actions30: 9,
      actions7: 3,
      sessions30: 3,
      families: families({ painting: { lifetime: 80, actions30: 9, days30: 5, actions7: 3 }, paints: { lifetime: 10 } }),
      units: {
        [TOMB_GUARD]: unitStats({
          lastActivityAt: ago(DAY),
          lastSessionAt: ago(DAY),
          sessions7: 2,
          sessions30: 2,
          sessionsTotal: 6,
          actions30: 3,
          lastStageChangeAt: ago(5 * DAY),
        }),
        [GAUNT]: unitStats({ lastActivityAt: ago(20 * DAY), lastSessionAt: ago(20 * DAY), sessions30: 1, sessionsTotal: 8, actions30: 1 }),
      },
      projects: { [REAL_PROJECT]: { lastChildActivityAt: ago(DAY) } },
    }),
  })
}

test('S1 new painter with nothing: create the first project, never a guide first', () => {
  const result = evaluateRecommendationsV11(snapshot('paint_miniature'))
  assert.equal(result.recommendations[0].ruleId, 'RA01')
  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA02'))
  assert.equal(result.recommendations[0].lifecycle, 'new')
})

test('S2 new content creator: first guide, and RA01 never outranks it', () => {
  const result = evaluateRecommendationsV11(snapshot('create_content'))
  assert.equal(result.recommendations[0].ruleId, 'RA02')
  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA01'))
})

test('S3 just created an empty project: add a unit to that project', () => {
  const fresh = project(REAL_PROJECT, 'Silver Tower', { createdAt: ago(DAY), updatedAt: ago(DAY) })
  const result = evaluateRecommendationsV11(snapshot('paint_miniature', { projects: [fresh] }))

  assert.equal(result.recommendations[0].ruleId, 'RA03')
  assert.equal(result.recommendations[0].primary.targetId, REAL_PROJECT)
  assert.notEqual(result.recommendations[0].ruleId, 'RA17')
})

test('S4 regression: established painter is never sent to an old empty project', () => {
  const input = establishedPainter()
  const result = evaluateRecommendationsV11(input)

  assert.deepEqual(rules(result)[0], `RA09:${TOMB_GUARD}`)
  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA03'), 'RA03 must not be in the rotation')
  assert.deepEqual(rejectionsFor(result, 'RA03'), ['lifecycle_gate'])
  assert.equal(result.diagnostics.trace?.winner?.ruleId, 'RA09')
  // Tomb Guard was painted after its last stage change: updating it passes
  // the check-in gate, but shares the unit's work intent with Continue, so
  // the unit fills one slot.
  assert.ok(!rules(result).includes(`RA07:${TOMB_GUARD}`))
  assert.deepEqual(
    result.diagnostics.rejected
      .filter((entry) => entry.ruleId === 'RA07' && entry.targetId === TOMB_GUARD)
      .map((entry) => entry.reason),
    ['duplicate_intent']
  )

  // The shadow comparison exists to catch exactly this: V1 picks the project.
  assert.equal(evaluateRecommendations(input).recommendations[0].ruleId, 'RA03')
})

test('S4b a project the user featured stays eligible, behind active painting', () => {
  const input = establishedPainter()
  input.projects[0] = { ...input.projects[0], isFeatured: true }
  const result = evaluateRecommendationsV11(input)

  assert.ok(result.recommendations.some((item) => item.ruleId === 'RA03'))
  assert.equal(result.recommendations[0].ruleId, 'RA09', 'chosen, but active painting still comes first')
})

test('S5 lapsed painter: resume the most-worked unit with a welcome, no onboarding', () => {
  const input = snapshot('paint_miniature', {
    projects: [project(TEST_PROJECT, 'Test project')],
    units: [
      unit(TOMB_GUARD, 'Tomb Guard', { lastSessionAt: ago(40 * DAY) }),
      unit(GAUNT, 'The Gaunt Summoner', { lastSessionAt: ago(45 * DAY) }),
    ],
    totals: { projects: 1, units: 2, guides: 0, sessions: 14, ownedPaints: 0, savedGuides: 0 },
    activity: activity({
      firstMeaningfulAt: ago(300 * DAY),
      lastMeaningfulAt: ago(40 * DAY),
      daysLifetime: 20,
      actionsLifetime: 30,
      families: families({ painting: { lifetime: 30 } }),
      units: {
        [TOMB_GUARD]: unitStats({ lastActivityAt: ago(40 * DAY), lastSessionAt: ago(40 * DAY), sessionsTotal: 12 }),
        [GAUNT]: unitStats({ lastActivityAt: ago(45 * DAY), lastSessionAt: ago(45 * DAY), sessionsTotal: 2 }),
      },
    }),
  })
  const result = evaluateRecommendationsV11(input)

  assert.equal(result.recommendations[0].lifecycle, 'lapsed')
  assert.equal(rules(result)[0], `RA09:${TOMB_GUARD}`)
  assert.equal(result.recommendations[0].eyebrow, 'Welcome Back')
  assert.ok(!result.recommendations.some((item) => ['RA01', 'RA02', 'RA03'].includes(item.ruleId)))
})

test('S6 active creator: continue yesterday’s draft ahead of older painting', () => {
  const draft = guide(id(300), 'Verdigris in three layers', { updatedAt: ago(DAY) })
  const input = snapshot('create_content', {
    guides: [draft],
    units: [unit(TOMB_GUARD, 'Tomb Guard', { lastSessionAt: ago(20 * DAY) })],
    activity: activity({
      firstMeaningfulAt: ago(100 * DAY),
      lastMeaningfulAt: ago(DAY),
      daysLifetime: 15,
      actionsLifetime: 30,
      days30: 4,
      actions30: 8,
      actions7: 2,
      families: families({
        guides: { lifetime: 20, actions30: 6, days30: 3, actions7: 2 },
        painting: { lifetime: 10, actions30: 2, days30: 1 },
      }),
      units: { [TOMB_GUARD]: unitStats({ lastActivityAt: ago(20 * DAY), lastSessionAt: ago(20 * DAY), sessionsTotal: 3, actions30: 1 }) },
      guides: { [draft.id]: { lastEditAt: ago(DAY), contentCount: 5 } },
    }),
  })
  const result = evaluateRecommendationsV11(input)

  assert.equal(rules(result)[0], `RA15:${draft.id}`)
  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA02'))
})

test('S7 recent unlogged session is protected; an accidental 1-minute timer is not', () => {
  const input = establishedPainter()
  input.latestEndedSession = {
    id: id(400),
    unitId: TOMB_GUARD,
    startedAt: ago(4 * HOUR),
    endedAt: ago(3 * HOUR),
    hasNotes: false,
    durationSeconds: 45 * 60,
  }
  const result = evaluateRecommendationsV11(input)
  assert.equal(result.recommendations[0].ruleId, 'RA10')
  assert.equal(result.diagnostics.trace?.winner?.protected, true)

  input.latestEndedSession = { ...input.latestEndedSession, durationSeconds: 60 }
  const accidental = evaluateRecommendationsV11(input)
  assert.notEqual(accidental.recommendations[0].ruleId, 'RA10')
  assert.deepEqual(rejectionsFor(accidental, 'RA10'), ['no_real_outcome'])
})

test('S7b a timer forgotten weeks ago is closed at the cap, not "running"', () => {
  const forgotten = {
    id: id(401),
    unitId: TOMB_GUARD,
    startedAt: ago(48 * DAY),
    endedAt: null,
    hasNotes: false,
    durationSeconds: null,
  }
  const settled = settleOpenSession(forgotten, null, NOW_MS)
  assert.equal(settled.activeSession, null)
  assert.equal(settled.latestEndedSession?.endedAt, new Date(Date.parse(forgotten.startedAt) + 2 * HOUR).toISOString())
  assert.equal(settled.latestEndedSession?.durationSeconds, 2 * 60 * 60)

  // Lapsed painter whose last act was leaving that timer on: welcome them
  // back to the unit, no "Finish your session" from 48 days ago.
  const input = snapshot('paint_miniature', {
    units: [unit(TOMB_GUARD, 'Tomb Guard', { lastSessionAt: ago(48 * DAY) })],
    totals: { projects: 0, units: 1, guides: 0, sessions: 6, ownedPaints: 0, savedGuides: 0 },
    activity: activity({
      firstMeaningfulAt: ago(200 * DAY),
      lastMeaningfulAt: ago(48 * DAY),
      daysLifetime: 8,
      actionsLifetime: 14,
      families: families({ painting: { lifetime: 14 } }),
      units: { [TOMB_GUARD]: unitStats({ lastActivityAt: ago(48 * DAY), lastSessionAt: ago(48 * DAY), sessionsTotal: 6 }) },
    }),
    ...settled,
  })
  const result = evaluateRecommendationsV11(input)
  assert.equal(rules(result)[0], `RA09:${TOMB_GUARD}`)
  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA10'))
})

test('S7c a timer started within the cap is still running and protected', () => {
  const running = {
    id: id(402),
    unitId: TOMB_GUARD,
    startedAt: ago(90 * 60 * 1000),
    endedAt: null,
    hasNotes: false,
    durationSeconds: null,
  }
  const settled = settleOpenSession(running, null, NOW_MS)
  assert.equal(settled.activeSession, running)

  const input = { ...establishedPainter(), ...settled }
  const result = evaluateRecommendationsV11(input)
  assert.equal(result.recommendations[0].ruleId, 'RA10')
  assert.equal(result.recommendations[0].title, 'Finish your session on Tomb Guard')
})

test('S7d a later ended session wins over an older capped timer', () => {
  const capped = { id: id(403), unitId: GAUNT, startedAt: ago(10 * DAY), endedAt: null, hasNotes: false, durationSeconds: null }
  const ended = { id: id(404), unitId: TOMB_GUARD, startedAt: ago(5 * HOUR), endedAt: ago(4 * HOUR), hasNotes: true, durationSeconds: 3600 }
  assert.equal(settleOpenSession(capped, ended, NOW_MS).latestEndedSession, ended)
})

test('S8 a finished unit is never nagged with unit work', () => {
  const done = unit(TOMB_GUARD, 'Tomb Guard', { status: 'complete', lastDoneStepKey: 'done', hasAnyImage: false, imageUrl: null })
  const input = snapshot('paint_miniature', {
    units: [done],
    activity: activity({
      firstMeaningfulAt: ago(60 * DAY),
      lastMeaningfulAt: ago(DAY),
      daysLifetime: 6,
      actionsLifetime: 12,
      days30: 2,
      actions30: 3,
      units: { [TOMB_GUARD]: unitStats({ lastActivityAt: ago(DAY), lastSessionAt: ago(DAY), sessionsTotal: 5 }) },
    }),
  })
  const result = evaluateRecommendationsV11(input)
  assert.ok(!result.recommendations.some((item) => item.primary.targetId === TOMB_GUARD))
})

test('S9 paint collector is never told to start a collection', () => {
  const input = establishedPainter()
  input.totals.ownedPaints = 80
  input.onboarding = { goalKey: 'organize_hobby', experienceLevel: 'experienced', startedAt: ago(200 * DAY) }
  input.activity!.families.paints = { lifetime: 120, actions30: 6, days30: 3, actions7: 1 }
  const result = evaluateRecommendationsV11(input)

  assert.ok(!result.recommendations.some((item) => item.ruleId === 'RA13'))
  assert.equal(result.recommendations[0].ruleId, 'RA09')
})

test('S10 the unit painted yesterday beats a nearly-done unit untouched for 100 days', () => {
  const input = snapshot('paint_miniature', {
    units: [
      unit(TOMB_GUARD, 'Tomb Guard', { lastSessionAt: ago(DAY), lastDoneStepKey: 'primed' }),
      unit(GAUNT, 'The Gaunt Summoner', { lastSessionAt: ago(100 * DAY), lastDoneStepKey: 'fine_details' }),
    ],
    activity: activity({
      firstMeaningfulAt: ago(300 * DAY),
      lastMeaningfulAt: ago(DAY),
      daysLifetime: 30,
      actionsLifetime: 60,
      days30: 3,
      actions30: 4,
      actions7: 1,
      sessions30: 2,
      families: families({ painting: { lifetime: 60, actions30: 4, days30: 3, actions7: 1 } }),
      units: {
        [TOMB_GUARD]: unitStats({ lastActivityAt: ago(DAY), lastSessionAt: ago(DAY), sessions7: 1, sessions30: 2, sessionsTotal: 2, actions30: 2 }),
        [GAUNT]: unitStats({ lastActivityAt: ago(100 * DAY), lastSessionAt: ago(100 * DAY), sessionsTotal: 20 }),
      },
    }),
  })
  const order = rules(evaluateRecommendationsV11(input))

  assert.equal(order[0], `RA09:${TOMB_GUARD}`)
  assert.ok(order.indexOf(`RA09:${GAUNT}`) > order.indexOf(`RA09:${TOMB_GUARD}`))
})

test('S11 not interested removes that key; the next candidate takes over', () => {
  const input = establishedPainter()
  const [first] = evaluateRecommendationsV11(input).recommendations
  const after = evaluateRecommendationsV11(input, { dismissedKeys: [first.recommendationKey] })

  assert.ok(!after.recommendations.some((item) => item.recommendationKey === first.recommendationKey))
  // Dismissal is per key: the unit's stage check-in, merged behind Continue
  // until now, is the strongest remaining candidate.
  assert.equal(rules(after)[0], `RA07:${TOMB_GUARD}`)
})

test('S12 remind me later hides for now and changes no relevance', () => {
  const input = establishedPainter()
  const before = evaluateRecommendationsV11(input).recommendations
  const snoozed = buildSuppression(
    [{ recommendation_key: before[0].recommendationKey, status: 'snoozed', snoozed_until: ago(-7 * DAY), cooldown_until: null }],
    null,
    NOW_MS
  )
  const after = evaluateRecommendationsV11(input, snoozed).recommendations

  assert.ok(!after.some((item) => item.recommendationKey === before[0].recommendationKey))
  for (const item of after) {
    const same = before.find((entry) => entry.recommendationKey === item.recommendationKey)
    if (same) assert.equal(item.score, same.score, `${item.ruleId} score unchanged by a snooze`)
  }
})

test('S13 show another walks distinct candidates, never cycling back', () => {
  const input = establishedPainter()
  const seen: string[] = []

  for (let step = 0; step < 12; step += 1) {
    const [next] = evaluateRecommendationsV11(input, { excludeKeys: seen }).recommendations
    if (!next) break
    assert.ok(!seen.includes(next.recommendationKey))
    seen.push(next.recommendationKey)
  }

  assert.equal(new Set(seen).size, seen.length)
})

test('S14 a deleted target invalidates the click instead of counting as interest or success', () => {
  const clicked = { ruleId: 'RA03' as const, targetId: id(999), contextHash: 'x', clickedAt: ago(HOUR) }
  const input = establishedPainter()

  assert.equal(reconcileClickedInstance(clicked, input), 'invalidated')
  // If the snapshot hit its row cap, "not found" proves nothing.
  input.coverage = { unitsTruncated: false, projectsTruncated: true, guidesTruncated: false }
  assert.equal(reconcileClickedInstance(clicked, input), 'pending')
})

test('S15 missing activity history never makes a real user "new"', () => {
  const input = establishedPainter()
  input.activity = null
  const context = buildUserContext(input)
  const result = evaluateRecommendationsV11(input)

  assert.notEqual(context.lifecycle, 'new')
  assert.equal(context.confidence, 'low')
  assert.ok(!result.recommendations.some((item) => ['RA01', 'RA02'].includes(item.ruleId)))
})

test('stage check-in needs painting after the last recorded stage change', () => {
  const input = establishedPainter()
  input.activity!.units[TOMB_GUARD] = {
    ...input.activity!.units[TOMB_GUARD],
    lastStageChangeAt: ago(HOUR),
  }
  const result = evaluateRecommendationsV11(input)

  assert.ok(!rules(result).includes(`RA07:${TOMB_GUARD}`))
  assert.ok(result.diagnostics.rejected.some((entry) => entry.ruleId === 'RA07' && entry.reason === 'no_real_outcome'))
})

test('abandonment: a provisional name alone never excludes, featuring always protects', () => {
  const input = establishedPainter()
  const freshTest = project(id(110), 'Test layout', { createdAt: ago(3 * DAY) })
  const featuredOld = project(id(111), 'Test project', { isFeatured: true })

  assert.ok(projectAbandonmentRisk(freshTest, input, NOW_MS).risk < 70)
  assert.ok(projectAbandonmentRisk(featuredOld, input, NOW_MS).risk < 70)
  assert.ok(projectAbandonmentRisk(input.projects[0], input, NOW_MS).risk >= 70)
})

test('lifecycle edges: an empty project is not activation; 3 active days is established', () => {
  const onlyProject = snapshot('paint_miniature', { projects: [project(TEST_PROJECT, 'Mine')] })
  assert.equal(buildUserContext(onlyProject).lifecycle, 'new')

  const activated = snapshot('paint_miniature', {
    activity: activity({ firstMeaningfulAt: ago(DAY), lastMeaningfulAt: ago(DAY), daysLifetime: 1, actionsLifetime: 2, days30: 1, actions30: 2 }),
  })
  assert.equal(buildUserContext(activated).lifecycle, 'activated')

  const established = snapshot('paint_miniature', {
    activity: activity({ firstMeaningfulAt: ago(9 * DAY), lastMeaningfulAt: ago(DAY), daysLifetime: 3, actionsLifetime: 3, days30: 3, actions30: 3 }),
  })
  assert.equal(buildUserContext(established).lifecycle, 'established')
})

test('the onboarding goal fades once behaviour points elsewhere', () => {
  const creatorWhoPaints = snapshot('create_content', {
    activity: activity({
      firstMeaningfulAt: ago(100 * DAY),
      lastMeaningfulAt: ago(DAY),
      daysLifetime: 20,
      actionsLifetime: 40,
      days30: 6,
      actions30: 10,
      actions7: 3,
      families: families({ painting: { lifetime: 40, actions30: 10, days30: 6, actions7: 3 } }),
    }),
  })
  const context = buildUserContext(creatorWhoPaints)

  assert.equal(context.intent, 'painting')
  assert.ok(intentFit(context, 'painting') > intentFit(context, 'guides'))
})

test('activity parsing is defensive: junk reads as zero, never as invented activity', () => {
  assert.equal(parseActivity(null), null)
  const parsed = parseActivity({ actions_lifetime: 'lots', units: [{ unit_id: 5 }, { unit_id: TOMB_GUARD, sessions_7: -3 }], families: { painting: { lifetime: 4 } } })!

  assert.equal(parsed.actionsLifetime, 0)
  assert.deepEqual(Object.keys(parsed.units), [TOMB_GUARD])
  assert.equal(parsed.units[TOMB_GUARD].sessions7, 0)
  assert.equal(parsed.families.painting.lifetime, 4)
  assert.equal(parsed.families.guides.lifetime, 0)
})

test('ignored impressions lower novelty, not eligibility', () => {
  const input = establishedPainter()
  const [top] = evaluateRecommendationsV11(input).recommendations
  const after = evaluateRecommendationsV11(input, { ignoredImpressions: { [top.recommendationKey]: 2 } }).recommendations
  const same = after.find((item) => item.recommendationKey === top.recommendationKey)

  assert.ok(same)
  assert.ok(same.score < top.score)
})

test('traces carry ids and numbers only, and ranking is deterministic', () => {
  const input = establishedPainter()
  const first = evaluateRecommendationsV11(input)
  const shuffled = evaluateRecommendationsV11({ ...input, units: [...input.units].reverse(), projects: [...input.projects].reverse() })

  assert.deepEqual(rules(first), rules(shuffled))
  const trace = JSON.stringify(first.diagnostics.trace)
  for (const name of ['Tomb Guard', 'Test project', 'Gaunt', 'example.test']) {
    assert.ok(!trace.includes(name), `trace leaks "${name}"`)
  }
  assert.ok(first.diagnostics.trace?.winner?.parts)
})
