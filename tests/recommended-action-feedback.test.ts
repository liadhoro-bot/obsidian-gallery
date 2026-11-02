import assert from 'node:assert/strict'
import test from 'node:test'
import { isRecommendedActionEnabledFor } from '../lib/recommended-action/config'
import { reconcileClickedInstance } from '../lib/recommended-action/completion'
import { resolveActionDestination } from '../lib/recommended-action/dispatch'
import { evaluateRecommendations } from '../lib/recommended-action/engine'
import {
  IGNORED_IMPRESSION_LIMIT,
  buildSuppression,
  nextImpressionState,
  parseRecommendationKey,
  withFamilyPenalty,
  type ImpressionState,
} from '../lib/recommended-action/feedback'
import { unitProgressFingerprint } from '../lib/recommended-action/rules'
import type { EngineSnapshot, SnapshotUnit } from '../lib/recommended-action/types'

const NOW = '2026-11-01T12:00:00.000Z'
const NOW_MS = Date.parse(NOW)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function id(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function ago(ms: number) {
  return new Date(NOW_MS - ms).toISOString()
}

function unit(overrides: Partial<SnapshotUnit> = {}): SnapshotUnit {
  return {
    id: id(200),
    name: 'Tomb Guard',
    status: 'active',
    isFeatured: true,
    imageUrl: null,
    hasAnyImage: false,
    createdAt: ago(40 * DAY),
    updatedAt: ago(9 * DAY),
    lastSessionAt: ago(9 * DAY),
    lastDoneStepKey: 'primed',
    hasRecordedProgress: true,
    projectIds: [],
    ...overrides,
  }
}

function snapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    userId: id(1),
    now: NOW,
    onboarding: { goalKey: 'paint_miniature', experienceLevel: 'know_basics', startedAt: ago(30 * DAY) },
    projects: [],
    units: [],
    guides: [],
    activeSession: null,
    latestEndedSession: null,
    totals: { projects: 0, units: 0, guides: 0, sessions: 0, ownedPaints: 0, savedGuides: 0 },
    ...overrides,
  }
}

test('recommendation keys round-trip and reject anything malformed', () => {
  const [first] = evaluateRecommendations(snapshot()).recommendations
  assert.deepEqual(parseRecommendationKey(first.recommendationKey), {
    ruleId: 'RA01',
    targetId: null,
    contextHash: first.recommendationKey.split(':')[2],
  })
  assert.equal(parseRecommendationKey(`RA04:${id(5)}:abc12`)?.targetId, id(5))

  for (const bad of ['RA99:none:abc', 'RA04:not-a-uuid:abc', 'RA04:none:ABC!', 'RA04:none:a:b', 42, null]) {
    assert.equal(parseRecommendationKey(bad), null, String(bad))
  }
})

test('a click alone never completes; the real outcome does', () => {
  const clickedAt = ago(2 * HOUR)
  const firstProject = { ruleId: 'RA01' as const, targetId: null, contextHash: 'x', clickedAt }

  assert.equal(reconcileClickedInstance(firstProject, snapshot()), 'pending')
  assert.equal(
    reconcileClickedInstance(firstProject, snapshot({ totals: { ...snapshot().totals, projects: 1 } })),
    'completed'
  )
})

test('photo, progress and session goals check the targeted unit', () => {
  const clickedAt = ago(HOUR)
  const before = unit()
  const photo = { ruleId: 'RA04' as const, targetId: before.id, contextHash: 'x', clickedAt }
  const progress = {
    ruleId: 'RA07' as const,
    targetId: before.id,
    contextHash: unitProgressFingerprint(before),
    clickedAt,
  }
  const paint = { ruleId: 'RA09' as const, targetId: before.id, contextHash: 'x', clickedAt }

  assert.equal(reconcileClickedInstance(photo, snapshot({ units: [before] })), 'pending')
  assert.equal(reconcileClickedInstance(photo, snapshot({ units: [unit({ hasAnyImage: true })] })), 'completed')

  // Opening the progress tab without changing a stage is not completion.
  assert.equal(reconcileClickedInstance(progress, snapshot({ units: [before] })), 'pending')
  assert.equal(
    reconcileClickedInstance(progress, snapshot({ units: [unit({ lastDoneStepKey: 'initial_paints' })] })),
    'completed'
  )

  assert.equal(reconcileClickedInstance(paint, snapshot({ units: [before] })), 'pending')
  assert.equal(
    reconcileClickedInstance(
      paint,
      snapshot({
        units: [before],
        activeSession: { id: id(400), unitId: before.id, startedAt: ago(10 * 60 * 1000), endedAt: null, hasNotes: false },
      })
    ),
    'completed'
  )
})

test('a session wrap-up completes only once it has ended with notes', () => {
  const running = { id: id(400), unitId: id(200), startedAt: ago(2 * HOUR), endedAt: null, hasNotes: false }
  const instance = { ruleId: 'RA10' as const, targetId: running.id, contextHash: 'x', clickedAt: ago(HOUR) }

  assert.equal(reconcileClickedInstance(instance, snapshot({ activeSession: running })), 'pending')
  assert.equal(
    reconcileClickedInstance(instance, snapshot({ latestEndedSession: { ...running, endedAt: ago(5 * 60 * 1000) } })),
    'pending'
  )
  assert.equal(
    reconcileClickedInstance(
      instance,
      snapshot({ latestEndedSession: { ...running, endedAt: ago(5 * 60 * 1000), hasNotes: true } })
    ),
    'completed'
  )
})

test('guide draft completes on a save after the click; library browsing never completes', () => {
  const draft = {
    id: id(300), title: 'Verdigris', visibility: 'draft' as const, imageUrl: null,
    createdAt: ago(10 * DAY), updatedAt: ago(4 * DAY),
  }
  const instance = { ruleId: 'RA15' as const, targetId: draft.id, contextHash: 'x', clickedAt: ago(HOUR) }

  assert.equal(reconcileClickedInstance(instance, snapshot({ guides: [draft] })), 'pending')
  assert.equal(
    reconcileClickedInstance(instance, snapshot({ guides: [{ ...draft, updatedAt: ago(10 * 60 * 1000) }] })),
    'completed'
  )

  const browse = { ruleId: 'RA17' as const, targetId: null, contextHash: 'x', clickedAt: ago(HOUR) }
  assert.equal(reconcileClickedInstance(browse, snapshot()), 'pending')
  assert.equal(reconcileClickedInstance({ ...browse, clickedAt: ago(8 * DAY) }, snapshot()), 'expired')
})

test('stored rows become suppression the engine respects', () => {
  const input = snapshot()
  const [first] = evaluateRecommendations(input).recommendations
  const row = (status: 'completed' | 'dismissed' | 'snoozed', extra = {}) => ({
    recommendation_key: first.recommendationKey,
    status,
    snoozed_until: null,
    cooldown_until: null,
    ...extra,
  })

  for (const stored of [
    row('completed'),
    row('dismissed'),
    row('snoozed', { snoozed_until: new Date(NOW_MS + DAY).toISOString() }),
  ]) {
    const suppression = buildSuppression([stored], null, NOW_MS)
    const keys = evaluateRecommendations(input, suppression).recommendations.map((item) => item.recommendationKey)
    assert.ok(!keys.includes(first.recommendationKey), stored.status)
  }

  // An expired snooze no longer hides it.
  const expired = buildSuppression([row('snoozed', { snoozed_until: ago(HOUR) })], null, NOW_MS)
  assert.equal(evaluateRecommendations(input, expired).recommendations[0].recommendationKey, first.recommendationKey)
})

test('family penalties are read only while active and only for real families', () => {
  const penalties = withFamilyPenalty({ bogus: 'x', guides: ago(DAY) }, 'painting', NOW_MS)
  const suppression = buildSuppression([], penalties, NOW_MS)

  assert.deepEqual(Object.keys(suppression.familyPenaltyUntil ?? {}), ['painting'])
  assert.equal(Date.parse(suppression.familyPenaltyUntil!.painting!) - NOW_MS, 14 * DAY)
})

test('three ignored impressions on separate visits start a 7-day cooldown', () => {
  let state: ImpressionState | null = null
  let at = NOW_MS

  for (let visit = 1; visit < IGNORED_IMPRESSION_LIMIT; visit += 1) {
    state = nextImpressionState(state, at)
    assert.equal(state?.ignored_impressions, visit)
    assert.equal(state?.cooldown_until, null)
    // Same visit: not counted again.
    assert.equal(nextImpressionState(state, at + 5 * 60 * 1000), null)
    at += DAY
  }

  state = nextImpressionState(state, at)
  assert.equal(state?.ignored_impressions, 0)
  assert.equal(Date.parse(state!.cooldown_until!) - at, 7 * DAY)

  const clicked = nextImpressionState(
    { first_impression_at: ago(DAY), last_impression_at: ago(DAY), ignored_impressions: 2, cooldown_until: null, clicked_at: ago(DAY) },
    NOW_MS
  )
  assert.equal(clicked?.ignored_impressions, 0)
  assert.equal(clicked?.cooldown_until, null)
})

test('rollout allowlist limits the card to listed accounts', () => {
  assert.equal(isRecommendedActionEnabledFor(id(1), {}), false)
  assert.equal(isRecommendedActionEnabledFor(id(1), { RECOMMENDED_ACTION_ENABLED: 'true' }), true)
  const env = { RECOMMENDED_ACTION_ENABLED: 'true', RECOMMENDED_ACTION_USER_IDS: ` ${id(1)} ,${id(2)}` }
  assert.equal(isRecommendedActionEnabledFor(id(1), env), true)
  assert.equal(isRecommendedActionEnabledFor(id(3), env), false)
})

test('create guide opens the guide starters directly', () => {
  assert.deepEqual(resolveActionDestination('CREATE_GUIDE', undefined), {
    kind: 'navigate',
    href: '/guides?tab=guides&create=1',
  })
})
