import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultGuideCards, flattenGuideContentItems, guideContentItems, guideIndexEntries, isGuideIndexCard, isGuideOwnedCard, newGuideCoverCardId, newGuideIndexCardId, resolveGuideCards, EMPTY_DECK_DESCRIPTION, GUIDE_COVER_CARD_ID, GUIDE_INDEX_CARD_ID } from '../app/guides/shared/guide-card-layout'
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

const inlineDeck = (id: string, steps: string[]) => ({ ...deck(id, steps, null), isInline: true }) as GuidesV3DeckDetail
const card = (deckId: string, cardId: string, hidden = false) => ({ deckId, cardId, groupId: deckId, hidden })

test('direct cards interleave with nested guides in saved order, and nested guides stay whole', () => {
  const decks = [deck('a', ['a1', 'a2'], null), deck('b', ['b1'], null), inlineDeck('own', ['x', 'y', 'new'])]
  const saved = [card('own', 'x'), card('a', 'a2'), card('own', 'y', true), card('b', 'b1'), card('a', 'a1')]
  const resolved = resolveGuideCards(decks, saved)
  // a1 joins its guide's block (where a2 sits); the new direct card goes last.
  assert.deepEqual(resolved.map(c => c.cardId), ['x', 'a2', 'a1', 'y', 'b1', 'new'])
  assert.deepEqual(guideContentItems(decks, resolved).map(item => item.kind === 'card' ? item.card.cardId : `[${item.deckId}]`), ['x', '[a]', 'y', '[b]', 'new'])
  // Reordering top-level items and flattening round-trips through the resolver.
  const items = guideContentItems(decks, resolved)
  const reordered = [items[1], items[0], ...items.slice(2)]
  assert.deepEqual(resolveGuideCards(decks, flattenGuideContentItems(reordered)).map(c => c.cardId), ['a2', 'a1', 'x', 'y', 'b1', 'new'])
})

test('the Guide Index lists nested guides in top-level order and never the direct cards', () => {
  const decks = [deck('a', ['a1'], null), deck('b', ['b1'], null), inlineDeck('own', ['x'])]
  const cards = resolveGuideCards(decks, [card('own', 'x'), card('b', 'b1'), card('a', 'a1')])
  assert.deepEqual(guideIndexEntries(decks, cards).map(entry => entry.deckId), ['b', 'a'])
})

test('a nested guide with no cards keeps a row, and a parked index goes top level', () => {
  const decks = [deck('a', [], null), inlineDeck('own', ['x'])]
  const resolved = resolveGuideCards(decks, [{ deckId: 'g', cardId: GUIDE_INDEX_CARD_ID, groupId: 'gone', hidden: false }, card('own', 'x')])
  assert.deepEqual(resolved.map(c => c.groupId), ['own', 'own'])
  assert.deepEqual(guideContentItems(decks, resolved).map(item => item.kind), ['card', 'card', 'guide'])
})

test('a guide can hold several Index Cards; exact duplicates still collapse', () => {
  const decks = [deck('a', ['a1'], null), inlineDeck('own', ['x'])]
  const first = { deckId: 'g', cardId: GUIDE_INDEX_CARD_ID, groupId: 'own', hidden: false }
  const second = { deckId: 'g', cardId: 'guide-index:k2', groupId: 'own', hidden: false }
  const resolved = resolveGuideCards(decks, [first, card('own', 'x'), second, second, card('a', 'a1')])
  assert.deepEqual(resolved.map(c => c.cardId), ['guide-index', 'x', 'guide-index:k2', 'a1'])
  assert.equal(resolved.filter(isGuideIndexCard).length, 2)
  assert.equal(newGuideIndexCardId([]), GUIDE_INDEX_CARD_ID)
  assert.match(newGuideIndexCardId(resolved), /^guide-index:[a-z0-9]+$/)
  // Every index card lists the same nested guides.
  assert.deepEqual(guideIndexEntries(decks, resolved).map(entry => entry.deckId), ['a'])
})

test('guide Cover cards are guide-owned: any number, never a chapter, movable anywhere', () => {
  const decks = [deck('a', ['a1'], null), inlineDeck('own', ['x'])]
  const cover = { deckId: 'g', cardId: GUIDE_COVER_CARD_ID, groupId: 'own', hidden: false }
  const cover2 = { deckId: 'g', cardId: 'guide-cover:k9', groupId: 'own', hidden: false }
  const resolved = resolveGuideCards(decks, [cover, card('a', 'a1'), cover2, card('own', 'x')])
  assert.deepEqual(resolved.map(c => c.cardId), ['guide-cover', 'a1', 'guide-cover:k9', 'x'])
  assert.equal(resolved.filter(isGuideOwnedCard).length, 2)
  assert.match(newGuideCoverCardId(resolved), /^guide-cover:[a-z0-9]+$/)
  // The index targets a1, never a cover parked in the same group.
  const plain = [deck('a', ['a1'], null)]
  const parked = resolveGuideCards(plain, [{ deckId: 'g', cardId: GUIDE_COVER_CARD_ID, groupId: 'a', hidden: false }, card('a', 'a1')])
  assert.equal(guideIndexEntries(plain, parked)[0].targetKey, 'a:a1')
})
