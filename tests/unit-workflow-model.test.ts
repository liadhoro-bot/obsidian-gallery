import assert from 'node:assert/strict'
import test from 'node:test'
import {
  summarizeWorkflow,
  withStepDone,
  type UnitWorkflow,
  type UnitWorkflowStep,
} from '../app/units/[id]/unit-workflow-model'

const step = (id: string, done = false, completedAt: string | null = null): UnitWorkflowStep => ({
  id,
  guideKey: 'guide:g1',
  title: `Step ${id}`,
  done,
  completedAt: done ? completedAt ?? '2026-11-01T10:00:00.000Z' : null,
})

test('past -> current -> next follows guide order', () => {
  const steps = [step('a', true), step('b', true), step('c'), step('d'), step('e')]
  const { lastCompleted, current, upcoming } = summarizeWorkflow(steps, 1)
  assert.equal(lastCompleted?.id, 'b')
  assert.equal(current?.id, 'c')
  assert.deepEqual(upcoming.map((item) => item.id), ['d'])
})

test('a step ticked out of order does not become current or next', () => {
  const steps = [step('a', true), step('b'), step('c', true), step('d')]
  const { current, upcoming } = summarizeWorkflow(steps, 2)
  assert.equal(current?.id, 'b')
  assert.deepEqual(upcoming.map((item) => item.id), ['d'])
})

test('nothing done before current falls back to the most recently ticked step', () => {
  const steps = [
    step('a'),
    step('b', true, '2026-11-02T10:00:00.000Z'),
    step('c', true, '2026-11-05T10:00:00.000Z'),
  ]
  const { lastCompleted, current } = summarizeWorkflow(steps)
  assert.equal(current?.id, 'a')
  assert.equal(lastCompleted?.id, 'c')
})

test('all done has no current step', () => {
  const { current, upcoming, lastCompleted } = summarizeWorkflow([step('a', true), step('b', true)])
  assert.equal(current, null)
  assert.deepEqual(upcoming, [])
  assert.equal(lastCompleted?.id, 'b')
})

test('withStepDone updates one unit-local step and the count', () => {
  const workflow: UnitWorkflow = {
    guides: [],
    steps: [step('a'), step('b')],
    completed: 0,
    total: 2,
    trackingAvailable: true,
  }
  const next = withStepDone(workflow, 'b', true)
  assert.equal(next.completed, 1)
  assert.equal(next.steps[1].done, true)
  assert.ok(next.steps[1].completedAt)
  assert.equal(workflow.steps[1].done, false, 'source workflow is not mutated')
  assert.equal(withStepDone(next, 'b', false).completed, 0)
})
