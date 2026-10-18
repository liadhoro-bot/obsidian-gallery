import type { GuidesV3DeckDetail } from '../guides-v3-detail-data'

// References belong to a guide. No source recipe or recipe_step is mutated.
export type GuideCardPlacement = { deckId: string; cardId: string; groupId: string; hidden: boolean }
// Guide-owned synthetic card (like 'cover', but its deckId is the guide's own
// id). Its rows are derived from the resolved layout at render time. A guide
// may have several: the first is 'guide-index', later ones 'guide-index:<id>'.
export const GUIDE_INDEX_CARD_ID = 'guide-index'
export function isGuideIndexCard(card: Pick<GuideCardPlacement, 'cardId'>) { return card.cardId === GUIDE_INDEX_CARD_ID || card.cardId.startsWith(GUIDE_INDEX_CARD_ID + ':') }
export function newGuideIndexCardId(cards: Pick<GuideCardPlacement, 'cardId'>[]) {
  return newGuideOwnedCardId(GUIDE_INDEX_CARD_ID, cards)
}
// Guide-owned Cover card: shows the guide's own title, description and cover
// image, so it always matches the guide. Same id scheme as the index.
export const GUIDE_COVER_CARD_ID = 'guide-cover'
export function isGuideCoverCard(card: Pick<GuideCardPlacement, 'cardId'>) { return card.cardId === GUIDE_COVER_CARD_ID || card.cardId.startsWith(GUIDE_COVER_CARD_ID + ':') }
export function newGuideCoverCardId(cards: Pick<GuideCardPlacement, 'cardId'>[]) {
  return newGuideOwnedCardId(GUIDE_COVER_CARD_ID, cards)
}
// Cards that belong to the guide itself rather than to any deck.
export function isGuideOwnedCard(card: Pick<GuideCardPlacement, 'cardId'>) { return isGuideIndexCard(card) || isGuideCoverCard(card) }
function newGuideOwnedCardId(base: string, cards: Pick<GuideCardPlacement, 'cardId'>[]) {
  if (!cards.some(card => card.cardId === base)) return base
  return `${base}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
export function guideCardKey(card: Pick<GuideCardPlacement, 'deckId' | 'cardId'>) { return card.deckId + ':' + card.cardId }
export function defaultGuideCards(decks: GuidesV3DeckDetail[]): GuideCardPlacement[] {
  return decks.flatMap(deck => {
    const cards: GuideCardPlacement[] = deck.steps.map(step => ({ deckId: deck.id, cardId: step.id, groupId: deck.id, hidden: false }))
    if (deck.coverPosition !== null) cards.splice(Math.max(0, Math.min(deck.coverPosition ?? 0, cards.length)), 0, { deckId: deck.id, cardId: 'cover', groupId: deck.id, hidden: false })
    return cards
  })
}

// A guide's inline deck (recipes.inline_guide_id) holds its direct cards.
// Those cards are top-level items, interleaved with the nested guides; every
// other deck stays one contiguous block.
function inlineDeckIds(decks: Pick<GuidesV3DeckDetail, 'id' | 'isInline'>[]) {
  return new Set(decks.filter(deck => deck.isInline).map(deck => deck.id))
}

export type GuideContentItem =
  | { kind: 'card'; card: GuideCardPlacement }
  | { kind: 'guide'; deckId: string; cards: GuideCardPlacement[] }

// The guide's top-level sequence. Without an inline deck this is exactly the
// nested guides in deck order. With one, the flat layout order decides: each
// inline card stands alone, and each nested guide sits where its first card
// is. Nested guides with no cards keep a row at the end.
export function guideContentItems(decks: Pick<GuidesV3DeckDetail, 'id' | 'isInline'>[], cards: GuideCardPlacement[]): GuideContentItem[] {
  const inline = inlineDeckIds(decks)
  if (!inline.size) return decks.map(deck => ({ kind: 'guide' as const, deckId: deck.id, cards: cards.filter(card => card.groupId === deck.id) }))
  const items: GuideContentItem[] = []
  const blocks = new Map<string, Extract<GuideContentItem, { kind: 'guide' }>>()
  for (const card of cards) {
    if (inline.has(card.groupId)) {
      items.push({ kind: 'card', card })
      continue
    }
    let block = blocks.get(card.groupId)
    if (!block) {
      block = { kind: 'guide', deckId: card.groupId, cards: [] }
      blocks.set(card.groupId, block)
      items.push(block)
    }
    block.cards.push(card)
  }
  for (const deck of decks) {
    if (!inline.has(deck.id) && !blocks.has(deck.id)) items.push({ kind: 'guide', deckId: deck.id, cards: [] })
  }
  return items
}

export function flattenGuideContentItems(items: GuideContentItem[]): GuideCardPlacement[] {
  return items.flatMap(item => item.kind === 'card' ? [item.card] : item.cards)
}

// Ignore stale/deleted references, deduplicate, and append newly added source cards.
export function resolveGuideCards(decks: GuidesV3DeckDetail[], saved: GuideCardPlacement[] = []): GuideCardPlacement[] {
  const defaults = defaultGuideCards(decks)
  const valid = new Map(defaults.map(card => [guideCardKey(card), card]))
  const groups = new Set(decks.map(deck => deck.id))
  const inline = inlineDeckIds(decks)
  // Where an index whose group left the guide is parked: top level when the
  // guide has direct cards, else the first nested guide.
  const indexHome = [...inline][0] ?? decks[0]?.id
  const resolved: GuideCardPlacement[] = []
  const indexKeys = new Set<string>()
  for (const card of saved) {
    if (isGuideOwnedCard(card)) {
      // Any number of index/cover cards, each once.
      const key = guideCardKey(card)
      if (indexKeys.has(key) || !decks.length) continue
      indexKeys.add(key)
      resolved.push({ ...card, groupId: groups.has(card.groupId) ? card.groupId : indexHome, hidden: card.hidden === true })
      continue
    }
    const key = guideCardKey(card)
    if (!valid.has(key)) continue
    resolved.push({ ...card, groupId: groups.has(card.groupId) ? card.groupId : card.deckId, hidden: card.hidden === true })
    valid.delete(key)
  }
  resolved.push(...valid.values())
  if (!inline.size) return decks.flatMap(deck => resolved.filter(card => card.groupId === deck.id))
  return flattenGuideContentItems(guideContentItems(decks, resolved))
}
export function parseGuideCardLayout(value: unknown): GuideCardPlacement[] {
  if (!Array.isArray(value)) return []
  return value.filter((card): card is GuideCardPlacement => Boolean(card) && typeof card === 'object' && typeof card.deckId === 'string' && typeof card.cardId === 'string' && typeof card.groupId === 'string' && typeof card.hidden === 'boolean')
}

// Placeholder loadDeckDetail substitutes for a missing deck description.
export const EMPTY_DECK_DESCRIPTION = 'No description has been added to this deck yet.'

export type GuideIndexEntry = { deckId: string; title: string; subtitle: string | null; targetKey: string }
// One row per nested guide, in top-level order, that still has a visible
// content card; the row targets that guide's first visible card. Direct cards
// (the inline deck) are not chapters.
export function guideIndexEntries(decks: GuidesV3DeckDetail[], cards: GuideCardPlacement[]): GuideIndexEntry[] {
  const visible = cards.filter(card => !card.hidden && !isGuideOwnedCard(card))
  const deckById = new Map(decks.map(deck => [deck.id, deck]))
  return guideContentItems(decks, cards).flatMap(item => {
    if (item.kind !== 'guide') return []
    const deck = deckById.get(item.deckId)
    const first = visible.find(card => card.groupId === item.deckId)
    if (!deck || !first) return []
    return [{ deckId: deck.id, title: deck.title, subtitle: deck.description && deck.description !== EMPTY_DECK_DESCRIPTION ? deck.description.trim() || null : null, targetKey: guideCardKey(first) }]
  })
}
