import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGuideCards, guideIndexEntries, resolveGuideCards, EMPTY_DECK_DESCRIPTION } from '../app/guides/shared/guide-card-layout'
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
const titled = (id: string, steps: string[], description: string | null = null) => ({ ...deck(id, steps, null), title: id.toUpperCase(), description }) as GuidesV3DeckDetail
const index = (groupId: string, hidden = false) => ({ deckId: 'guide', cardId: 'guide-index', groupId, hidden })

test('guide index survives resolution once, in place, and parks in the first deck when its group leaves', () => {
  const a = deck('a', ['a1'], null), b = deck('b', ['b1'], null)
  const saved = [{ deckId: 'a', cardId: 'a1', groupId: 'a', hidden: false }, index('b'), index('a'), { deckId: 'b', cardId: 'b1', groupId: 'b', hidden: false }]
  assert.deepEqual(resolveGuideCards([a, b], saved).map(c => c.cardId), ['a1', 'guide-index', 'b1'])
  assert.deepEqual(resolveGuideCards([a], saved).find(c => c.cardId === 'guide-index')?.groupId, 'a')
  assert.deepEqual(resolveGuideCards([], saved), [])
})
test('guide index entries follow deck order, skip decks without visible cards, and ignore the index itself', () => {
  const a = titled('a', ['a1', 'a2'], 'Basics'), b = titled('b', ['b1']), c = titled('c', ['c1'], EMPTY_DECK_DESCRIPTION)
  const cards = resolveGuideCards([c, a, b], [index('c'), { deckId: 'a', cardId: 'a1', groupId: 'a', hidden: true }, { deckId: 'b', cardId: 'b1', groupId: 'b', hidden: true }])
  assert.deepEqual(guideIndexEntries([c, a, b], cards), [
    { deckId: 'c', title: 'C', subtitle: null, targetKey: 'c:c1' },
    { deckId: 'a', title: 'A', subtitle: 'Basics', targetKey: 'a:a2' },
  ])
})
