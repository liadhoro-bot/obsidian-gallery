import assert from 'node:assert/strict'
import test from 'node:test'
import { deckCardStepFields } from '../app/guides/deck-card-rows'
import { isWorkflowStepByDefault, resolveWorkflowStep } from '../app/guides/shared/workflow-step'

test('paint lists and covers are reference cards by default; every other card is a step', () => {
  assert.equal(isWorkflowStepByDefault('paints'), false)
  assert.equal(isWorkflowStepByDefault('cover'), false)
  for (const template of ['step', 'theme', 'theme-alt', 'image', 'small-image', 'video', null]) {
    assert.equal(isWorkflowStepByDefault(template), true, String(template))
  }
})

test("the creator's switch overrides the card-type default", () => {
  assert.equal(resolveWorkflowStep(true, 'paints'), true)
  assert.equal(resolveWorkflowStep(false, 'step'), false)
  assert.equal(resolveWorkflowStep(null, 'step'), true)
  assert.equal(resolveWorkflowStep(undefined, 'paints'), false)
})

test('only an explicit choice is written to recipe_steps.workflow_step', () => {
  const base = { title: 'Layer skin', template: 'step', body: 'Thin layers', image: null }
  assert.equal('workflow_step' in deckCardStepFields(base, 0), false)
  assert.equal('workflow_step' in deckCardStepFields({ ...base, workflowStep: null }, 0), false)
  assert.equal(deckCardStepFields({ ...base, workflowStep: false }, 0).workflow_step, false)
  assert.equal(deckCardStepFields({ ...base, workflowStep: true }, 0).workflow_step, true)
})
