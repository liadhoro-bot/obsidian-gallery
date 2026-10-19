import assert from 'node:assert/strict'
import test from 'node:test'
import { guideDifficulty } from '../app/guides/shared/guide-difficulty'

test('a saved difficulty wins over the card-count guess', () => {
  assert.equal(guideDifficulty('Beginner', 40), 'Beginner')
  assert.equal(guideDifficulty('Advanced', 1), 'Advanced')
})

test('with nothing saved, difficulty is guessed from the card count', () => {
  assert.equal(guideDifficulty(null, 3), 'Beginner')
  assert.equal(guideDifficulty(undefined, 6), 'Intermediate')
  assert.equal(guideDifficulty('', 12), 'Advanced')
  assert.equal(guideDifficulty('Expert', 2), 'Beginner')
})
