// What a creator's public collection is - shared by their creator page
// (getCreatorPublicGuides) and the count on their contest entry card
// (getPublicGuideCreatorLeaderboard), so the two always agree.
//
// The collection is every public deck plus every guide composed from two or
// more public decks, each exactly once. A deck is shown by a guide that
// wraps only that deck - preferably one the creator composed (it has their
// own title and description), otherwise its auto-guide - so a deck and a
// single-deck guide of it never both appear.
//
// A guide's inline deck (recipes.inline_guide_id - the home of its direct
// cards) is never a deck of its own: callers leave it out of publicDeckIds
// and set hasPublicInline instead. Cards of its own make a composed guide a
// collection item even when it reuses only one deck, or none.

export type CollectionGuide = {
  id: string
  isAuto: boolean
  // The guide's public member decks, in position order, without its inline deck.
  publicDeckIds: string[]
  // The guide has a public inline deck (direct cards).
  hasPublicInline?: boolean
}

export function isMultiDeckGuide(guide: Pick<CollectionGuide, 'isAuto' | 'publicDeckIds' | 'hasPublicInline'>) {
  return !guide.isAuto && (new Set(guide.publicDeckIds).size > 1 || Boolean(guide.hasPublicInline))
}

function singleDeckOf(guide: CollectionGuide) {
  if (guide.hasPublicInline) return null
  const decks = new Set(guide.publicDeckIds)
  return decks.size === 1 ? guide.publicDeckIds[0] : null
}

// Picks the guides to list, keeping their input order.
export function selectCreatorCollection<T extends CollectionGuide>(guides: T[]): T[] {
  const deckShownBy = new Map<string, string>()
  const composedFirst = [...guides].sort((a, b) => Number(a.isAuto) - Number(b.isAuto))
  for (const guide of composedFirst) {
    const deckId = singleDeckOf(guide)
    if (deckId && !deckShownBy.has(deckId)) deckShownBy.set(deckId, guide.id)
  }
  return guides.filter((guide) => {
    const deckId = singleDeckOf(guide)
    if (deckId) return deckShownBy.get(deckId) === guide.id
    return isMultiDeckGuide(guide)
  })
}

// The number of items selectCreatorCollection lists for a creator, given
// their public decks (inline decks excluded) and their composed guides.
export function countCreatorCollection(
  publicDeckIds: string[],
  composedGuides: Pick<CollectionGuide, 'publicDeckIds' | 'hasPublicInline'>[]
) {
  return (
    new Set(publicDeckIds).size +
    composedGuides.filter((guide) => isMultiDeckGuide({ isAuto: false, publicDeckIds: guide.publicDeckIds, hasPublicInline: guide.hasPublicInline })).length
  )
}
