import assert from 'node:assert/strict'
import test from 'node:test'
import { socialDeckIdOf } from '../app/guides/shared/guide-social-deck'

test('likes and saves stay on the pinned deck when the guide is reordered', () => {
  assert.equal(socialDeckIdOf('a', ['a', 'b']), 'a')
  assert.equal(socialDeckIdOf('a', ['b', 'a']), 'a')
})

test('without a usable pin the first deck is used, as before', () => {
  assert.equal(socialDeckIdOf(null, ['b', 'a']), 'b')
  assert.equal(socialDeckIdOf(undefined, ['b', 'a']), 'b')
  // The pinned deck left the guide.
  assert.equal(socialDeckIdOf('gone', ['b', 'a']), 'b')
  assert.equal(socialDeckIdOf('a', []), undefined)
})
