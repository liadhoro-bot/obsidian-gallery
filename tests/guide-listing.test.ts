import { test } from 'node:test'
import assert from 'node:assert/strict'
import { upgradedGuideVisibility, withoutNestedAutoGuides } from '../app/guides/shared/guide-listing'

const auto = (id: string, deck: string) => ({ id, is_auto: true, guide_decks: [{ recipe_id: deck }] })
const composed = (id: string, ...decks: string[]) => ({ id, is_auto: false, guide_decks: decks.map((recipe_id) => ({ recipe_id })) })
const parents = (entries: [string, string[]][]) => new Map(entries.map(([deck, ids]) => [deck, new Set(ids)]))

test('building blocks inside a public guide are never listed on their own', () => {
  // E is public and contains A, B and C's decks.
  const listed = [composed('E', 'a', 'b', 'c'), auto('auto-a', 'a'), auto('auto-b', 'b'), auto('auto-c', 'c')]
  const ids = withoutNestedAutoGuides(listed, parents([['a', ['E']], ['b', ['E']], ['c', ['E']]])).map((g) => g.id)
  assert.deepEqual(ids, ['E'])
})

test('building blocks stay unlisted after the parent goes private', () => {
  // E is private now, so it is not in the listed set - but it still contains the decks.
  const listed = [auto('auto-a', 'a'), auto('auto-b', 'b')]
  assert.deepEqual(withoutNestedAutoGuides(listed, parents([['a', ['E']], ['b', ['E']]])), [])
})

test('a deck published on its own is still listed', () => {
  const listed = [auto('auto-solo', 'solo')]
  assert.deepEqual(withoutNestedAutoGuides(listed, parents([])).map((g) => g.id), ['auto-solo'])
})

test('a guide the owner made public stays listed even when nested', () => {
  // A is a composed guide its owner published, and it also sits inside E.
  const listed = [composed('A', 'a'), composed('E', 'a', 'b')]
  assert.deepEqual(withoutNestedAutoGuides(listed, parents([['a', ['A', 'E']]])).map((g) => g.id), ['A', 'E'])
})

test('opening a nested building block as a guide never makes it public', () => {
  assert.equal(upgradedGuideVisibility({ autoGuideVisibility: 'public', nestedInOtherGuide: true }), 'private')
})

test('opening a standalone published deck keeps it public', () => {
  assert.equal(upgradedGuideVisibility({ autoGuideVisibility: 'public', nestedInOtherGuide: false }), 'public')
})

test("the creator's explicit status always wins", () => {
  assert.equal(upgradedGuideVisibility({ explicit: 'public', autoGuideVisibility: 'private', nestedInOtherGuide: true }), 'public')
  assert.equal(upgradedGuideVisibility({ explicit: 'draft', autoGuideVisibility: 'public', nestedInOtherGuide: false }), 'draft')
})

test('a brand-new guide around a public deck is not public by default', () => {
  assert.equal(upgradedGuideVisibility({ nestedInOtherGuide: false }), 'private')
})
