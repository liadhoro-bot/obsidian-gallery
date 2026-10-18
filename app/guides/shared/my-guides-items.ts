// My Guides lists the viewer's guides and their decks together: a deck is a
// reusable guide in its own right, so it no longer needs a tab of its own.
// Decks keep their own routes and editor; this only merges the two lists.
//
// A public deck gets an auto-guide (recipes_ensure_guide). When that
// auto-guide is untouched it is the same content as the deck row, so it is
// left out here; its route keeps working. A customized auto-guide (own
// description/cover or a card layout) is listed alongside the deck.

export type MyGuidesSortMode = 'name-asc' | 'name-desc' | 'popularity' | 'new-old' | 'old-new'

type GuideLike = {
  id: string
  title: string
  createdAt: string
  likeCount: number
  saveCount: number
  mirrorsDeckId?: string
}

type DeckLike = {
  id: string
  title: string
  createdAt: string
  likeCount?: number
  saveCount?: number
}

export type MyGuidesItem<Guide extends GuideLike, Deck extends DeckLike> =
  | { kind: 'guide'; key: string; guide: Guide }
  | { kind: 'deck'; key: string; deck: Deck }

function sortKey(item: MyGuidesItem<GuideLike, DeckLike>) {
  const source = item.kind === 'guide' ? item.guide : item.deck
  return {
    title: source.title,
    createdAt: source.createdAt,
    popularity: (source.likeCount ?? 0) + (source.saveCount ?? 0),
  }
}

export function buildMyGuidesItems<Guide extends GuideLike, Deck extends DeckLike>(
  guides: Guide[],
  decks: Deck[],
  mode: MyGuidesSortMode
): MyGuidesItem<Guide, Deck>[] {
  const deckIds = new Set(decks.map((deck) => deck.id))
  const items: MyGuidesItem<Guide, Deck>[] = [
    ...guides
      .filter((guide) => !guide.mirrorsDeckId || !deckIds.has(guide.mirrorsDeckId))
      .map((guide) => ({ kind: 'guide' as const, key: `guide:${guide.id}`, guide })),
    ...decks.map((deck) => ({ kind: 'deck' as const, key: `deck:${deck.id}`, deck })),
  ]
  const compare: Record<MyGuidesSortMode, (a: ReturnType<typeof sortKey>, b: ReturnType<typeof sortKey>) => number> = {
    'name-asc': (a, b) => a.title.localeCompare(b.title),
    'name-desc': (a, b) => b.title.localeCompare(a.title),
    popularity: (a, b) => b.popularity - a.popularity,
    'new-old': (a, b) => b.createdAt.localeCompare(a.createdAt),
    'old-new': (a, b) => a.createdAt.localeCompare(b.createdAt),
  }
  return items
    .map((item) => ({ item, key: sortKey(item) }))
    .sort((a, b) => compare[mode](a.key, b.key))
    .map(({ item }) => item)
}
