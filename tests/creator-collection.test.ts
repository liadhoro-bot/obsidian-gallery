import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  countCreatorCollection,
  selectCreatorCollection,
  type CollectionGuide,
} from '../app/guides/shared/creator-collection'

const auto = (id: string, deck: string): CollectionGuide => ({ id, isAuto: true, publicDeckIds: [deck] })
const composed = (id: string, ...decks: string[]): CollectionGuide => ({ id, isAuto: false, publicDeckIds: decks })
const ids = (guides: CollectionGuide[]) => selectCreatorCollection(guides).map((guide) => guide.id)

test('a single-deck guide replaces its deck instead of appearing beside it', () => {
  const guides = [composed('mine-a', 'a'), auto('auto-a', 'a'), auto('auto-b', 'b')]
  assert.deepEqual(ids(guides), ['mine-a', 'auto-b'])
  assert.equal(countCreatorCollection(['a', 'b'], [{ publicDeckIds: ['a'] }]), 2)
})

test('a multi-deck guide is listed in addition to each of its decks', () => {
  const guides = [composed('set', 'a', 'b'), auto('auto-a', 'a'), auto('auto-b', 'b')]
  assert.deepEqual(ids(guides), ['set', 'auto-a', 'auto-b'])
  assert.equal(countCreatorCollection(['a', 'b'], [{ publicDeckIds: ['a', 'b'] }]), 3)
})

test('a deck with several auto-guides or single-deck guides still appears once', () => {
  const guides = [auto('auto-1', 'a'), auto('auto-2', 'a'), composed('mine-1', 'a'), composed('mine-2', 'a')]
  assert.deepEqual(ids(guides), ['mine-1'])
  assert.equal(countCreatorCollection(['a'], [{ publicDeckIds: ['a'] }, { publicDeckIds: ['a'] }]), 1)
})

test('only public decks decide whether a guide is single- or multi-deck', () => {
  // A guide of one public and one private deck stands for the public deck.
  const guides = [composed('mixed', 'a'), auto('auto-a', 'a')]
  assert.deepEqual(ids(guides), ['mixed'])
  // A composed guide with no public deck is not listed at all.
  assert.deepEqual(ids([composed('private-only')]), [])
  assert.equal(countCreatorCollection([], [{ publicDeckIds: [] }]), 0)
})

test('the page list and the entry-card count always agree, and no deck is listed twice', () => {
  let seed = 7
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed % n
  }
  for (let run = 0; run < 500; run += 1) {
    const decks = Array.from({ length: 1 + random(8) }, (_, index) => `d${index}`)
    // Every public deck has at least one auto-guide (the recipes trigger
    // creates one when a deck is made public); some have extra copies.
    const guides: CollectionGuide[] = decks.flatMap((deck) =>
      Array.from({ length: 1 + random(2) }, (_, copy) => auto(`auto-${deck}-${copy}`, deck))
    )
    const composedGuides = Array.from({ length: random(6) }, (_, index) => {
      const members = decks.filter(() => random(3) === 0)
      return composed(`mine-${index}`, ...members)
    })
    guides.push(...composedGuides)
    // Shuffle so the result never depends on input order.
    for (let index = guides.length - 1; index > 0; index -= 1) {
      const other = random(index + 1)
      ;[guides[index], guides[other]] = [guides[other], guides[index]]
    }

    const listed = selectCreatorCollection(guides)
    assert.equal(listed.length, countCreatorCollection(decks, composedGuides), `run ${run}: count mismatch`)

    const singleDeckShown = listed
      .filter((guide) => new Set(guide.publicDeckIds).size === 1)
      .map((guide) => guide.publicDeckIds[0])
    assert.deepEqual([...singleDeckShown].sort(), [...decks].sort(), `run ${run}: each deck must be shown exactly once`)
  }
})

test('a guide with direct cards is one collection item and its inline deck is never a deck', () => {
  const withCards = (id: string, ...decks: string[]): CollectionGuide => ({ id, isAuto: false, publicDeckIds: decks, hasPublicInline: true })
  // Direct cards plus one reused deck: the guide is listed beside that deck.
  assert.deepEqual(ids([withCards('own', 'a'), auto('auto-a', 'a')]), ['own', 'auto-a'])
  assert.equal(countCreatorCollection(['a'], [{ publicDeckIds: ['a'], hasPublicInline: true }]), 2)
  // Direct cards only: the guide alone.
  assert.deepEqual(ids([withCards('only-cards')]), ['only-cards'])
  assert.equal(countCreatorCollection([], [{ publicDeckIds: [], hasPublicInline: true }]), 1)
  // Without public direct cards nothing changes.
  assert.equal(countCreatorCollection(['a'], [{ publicDeckIds: ['a'], hasPublicInline: false }]), 1)
})
