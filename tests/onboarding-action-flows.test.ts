import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  onboardingActionDefinitions,
  onboardingFlowDefinitions,
  type OnboardingFlowName,
} from '../lib/onboarding/action-definitions'
import { resolveOnboardingActionDestination } from '../lib/onboarding/action-destinations'
import { selectVisibleOnboardingActionBatch } from '../lib/onboarding/action-batches'

const expectedActionCounts: Record<OnboardingFlowName, number> = {
  paint_miniature: 16,
  organize_hobby: 14,
  create_content: 13,
}

function actionsFor(flowName: OnboardingFlowName) {
  return onboardingActionDefinitions
    .filter((action) => action.flowName === flowName)
    .sort((first, second) => first.actionOrder - second.actionOrder)
}

test('goal-based onboarding flows expose the expected flow names and action counts', () => {
  assert.deepEqual(
    onboardingFlowDefinitions.map((flow) => flow.name).sort(),
    ['create_content', 'organize_hobby', 'paint_miniature']
  )

  for (const flowName of Object.keys(expectedActionCounts) as OnboardingFlowName[]) {
    assert.equal(actionsFor(flowName).length, expectedActionCounts[flowName])
  }
})

test('onboarding action definitions are complete and ordered per flow', () => {
  for (const flowName of Object.keys(expectedActionCounts) as OnboardingFlowName[]) {
    const actions = actionsFor(flowName)
    const actionKeys = new Set(actions.map((action) => action.actionKey))
    const actionOrders = actions.map((action) => action.actionOrder)

    assert.equal(actionKeys.size, actions.length, `${flowName} has duplicate action keys`)
    assert.deepEqual(
      actionOrders,
      Array.from({ length: actions.length }, (_, index) => index + 1),
      `${flowName} action order should be contiguous`
    )

    for (const action of actions) {
      assert.ok(action.milestoneKey, `${action.actionKey} is missing milestoneKey`)
      assert.ok(action.milestoneLabel, `${action.actionKey} is missing milestoneLabel`)
      assert.ok(action.milestoneOrder > 0, `${action.actionKey} is missing milestoneOrder`)
      assert.ok(action.breadcrumb, `${action.actionKey} is missing breadcrumb`)
      assert.ok(action.refPage, `${action.actionKey} is missing refPage`)
      assert.ok(action.refComponent, `${action.actionKey} is missing refComponent`)
      assert.ok(
        !action.refPage.startsWith('/'),
        `${action.actionKey} refPage should be semantic, not a URL`
      )
      assert.ok(
        !action.refPage.includes('#'),
        `${action.actionKey} refPage should not include a hash`
      )
      assert.ok(
        !action.refComponent.includes('#'),
        `${action.actionKey} refComponent should not include a hash`
      )
    }
  }
})

test('onboarding flow migrations seed every defined action', () => {
  const migrationPaths = [
    'supabase/migrations/20260823143000_expand_onboarding_action_flows.sql',
    'supabase/migrations/20260823152000_repair_onboarding_action_refs.sql',
  ]

  for (const migrationPath of migrationPaths) {
    const migrationSql = readFileSync(migrationPath, 'utf8')

    assert.match(migrationSql, /on conflict \(flow_name, action_key\)/i)

    for (const action of onboardingActionDefinitions) {
      assert.match(
        migrationSql,
        new RegExp(`'${action.actionKey}'`),
        `${migrationPath} is missing ${action.flowName}.${action.actionKey}`
      )
    }
  }
})

test('onboarding action route resolver maps semantic targets to real app routes', () => {
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: 'unit_detail', refComponent: 'progress_stage' },
      { subjectUnitId: 'unit-1' }
    ),
    '/units/unit-1?tab=progress#progress_stage'
  )
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: 'vault', refComponent: 'paint_collection' },
      {}
    ),
    '/vault?tab=collection#paint_collection'
  )
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: 'guide_builder', refComponent: 'card_paints' },
      { subjectGuideId: 'guide-1' }
    ),
    '/recipes/guide-1?tab=edit#card_paints'
  )
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: 'look_around', refComponent: null },
      {}
    ),
    '/dashboard?tab=painting-table'
  )
})

test('onboarding action route resolver keeps legacy literal paths usable', () => {
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: '/units/new', refComponent: 'new-unit-form' },
      {}
    ),
    '/units/new#new-unit-form'
  )
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: '/units/new#create_unit', refComponent: 'unit_name' },
      {}
    ),
    '/units/new#unit_name'
  )
  assert.equal(
    resolveOnboardingActionDestination(
      { refPage: '/vault?tab=collection', refComponent: 'paint-vault' },
      {}
    ),
    '/vault?tab=collection#paint-vault'
  )
})

test('all seeded onboarding actions resolve to known app surfaces', () => {
  const routeFiles = new Set([
    '/dashboard',
    '/projects',
    '/projects/[id]',
    '/recipes',
    '/recipes/[id]',
    '/units/new',
    '/units/[id]',
    '/vault',
  ])

  for (const action of onboardingActionDefinitions) {
    const href = resolveOnboardingActionDestination(
      { refPage: action.refPage, refComponent: action.refComponent },
      {
        subjectGuideId: 'guide-1',
        subjectProjectId: 'project-1',
        subjectSessionId: 'session-1',
        subjectUnitId: 'unit-1',
      }
    )
    const hashCount = (href.match(/#/g) ?? []).length
    const url = new URL(href, 'http://local.test')
    const routeKey = url.pathname
      .replace(/^\/projects\/[^/]+$/, '/projects/[id]')
      .replace(/^\/recipes\/[^/]+$/, '/recipes/[id]')
      .replace(/^\/units\/[^/]+$/, '/units/[id]')

    assert.ok(hashCount <= 1, `${action.actionKey} resolved to ${href}`)
    assert.ok(routeFiles.has(routeKey), `${action.actionKey} resolved to ${href}`)
  }

  for (const route of routeFiles) {
    const appRoute = route
      .replace('/projects/[id]', '/projects/[id]')
      .replace('/recipes/[id]', '/recipes/[id]')
      .replace('/units/[id]', '/units/[id]')
    assert.ok(
      existsSync(`app${appRoute}/page.tsx`),
      `${route} should have an app route`
    )
  }
})

test('visible onboarding action batch stays fixed until all three are complete', () => {
  const actions = Array.from({ length: 7 }, (_, index) => ({
    id: `action-${index + 1}`,
    completedAt: null as string | null,
  }))

  assert.deepEqual(
    selectVisibleOnboardingActionBatch(actions).map((action) => action.id),
    ['action-1', 'action-2', 'action-3']
  )

  actions[0].completedAt = '2026-08-24T00:00:00.000Z'
  actions[1].completedAt = '2026-08-24T00:01:00.000Z'
  assert.deepEqual(
    selectVisibleOnboardingActionBatch(actions).map((action) => action.id),
    ['action-1', 'action-2', 'action-3']
  )

  actions[2].completedAt = '2026-08-24T00:02:00.000Z'
  assert.deepEqual(
    selectVisibleOnboardingActionBatch(actions).map((action) => action.id),
    ['action-4', 'action-5', 'action-6']
  )
})
