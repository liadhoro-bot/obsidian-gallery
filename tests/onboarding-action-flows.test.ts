import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  onboardingActionDefinitions,
  onboardingFlowDefinitions,
  type OnboardingFlowName,
} from '../lib/onboarding/action-definitions'
import { resolveOnboardingActionDestination } from '../lib/onboarding/action-destinations'

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
    }
  }
})

test('expanded onboarding flow migration seeds every defined action', () => {
  const migrationSql = readFileSync(
    'supabase/migrations/20260823143000_expand_onboarding_action_flows.sql',
    'utf8'
  )

  assert.match(migrationSql, /on conflict \(flow_name, action_key\)/i)

  for (const action of onboardingActionDefinitions) {
    assert.match(
      migrationSql,
      new RegExp(`'${action.actionKey}'`),
      `migration is missing ${action.flowName}.${action.actionKey}`
    )
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
