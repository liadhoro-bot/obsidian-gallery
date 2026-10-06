import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGuideCards, resolveGuideCards } from '../app/guides/shared/guide-card-layout'
import type { GuidesV3DeckDetail } from '../app/guides/guides-v3-detail-data'
const deck = (id: string, steps: string[], coverPosition: number | null = 0) => ({ id, coverPosition, steps: steps.map(id => ({ id })) }) as GuidesV3DeckDetail

test('guide overrides reorder, hide, and transfer cards without mutating source decks', () => {
  const decks = [deck('a', ['a1', 'a2']), deck('b', ['b1'], null)]
  const before = JSON.stringify(decks)
  const cards = defaultGuideCards(decks)
  const saved = [cards[2], { ...cards[0], hidden: true }, cards[3], { ...cards[1], groupId: 'b' }]
  const resolved = resolveGuideCards(decks, saved)
  assert.deepEqual(resolved.map(c => c.cardId), ['a2', 'cover', 'b1', 'a1'])
  assert.deepEqual(resolved.filter(c => !c.hidden).map(c => c.cardId), ['a2', 'b1', 'a1'])
  assert.equal(JSON.stringify(decks), before)
})
test('deleted cards, removed deck groups, duplicate references and new source cards reconcile safely', () => {
  const decks = [deck('a', ['new', 'kept'], null)]
  const ref = { deckId: 'a', groupId: 'removed', cardId: 'kept', hidden: true }
  const result = resolveGuideCards(decks, [ref, ref, { ...ref, cardId: 'deleted' }])
  assert.deepEqual(result, [{ ...ref, groupId: 'a' }, { deckId: 'a', groupId: 'a', cardId: 'new', hidden: false }])
})
test('deck ordering moves the guide groups while preserving custom card order', () => {
  const a = deck('a', ['a1', 'a2'], null), b = deck('b', ['b1'], 1)
  const saved = defaultGuideCards([a, b]); [saved[0], saved[1]] = [saved[1], saved[0]]
  assert.deepEqual(resolveGuideCards([b, a], saved).map(c => c.cardId), ['b1', 'cover', 'a2', 'a1'])
})
