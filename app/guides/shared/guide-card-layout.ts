import type { GuidesV3DeckDetail } from '../guides-v3-detail-data'

// References belong to a guide. No source recipe or recipe_step is mutated.
export type GuideCardPlacement = { deckId: string; cardId: string; groupId: string; hidden: boolean }
// Guide-owned synthetic card (like 'cover', but its deckId is the guide's own
// id). Its rows are derived from the resolved layout at render time.
export const GUIDE_INDEX_CARD_ID = 'guide-index'
export function isGuideIndexCard(card: Pick<GuideCardPlacement, 'cardId'>) { return card.cardId === GUIDE_INDEX_CARD_ID }
export function guideCardKey(card: Pick<GuideCardPlacement, 'deckId' | 'cardId'>) { return card.deckId + ':' + card.cardId }
export function defaultGuideCards(decks: GuidesV3DeckDetail[]): GuideCardPlacement[] {
  return decks.flatMap(deck => {
    const cards: GuideCardPlacement[] = deck.steps.map(step => ({ deckId: deck.id, cardId: step.id, groupId: deck.id, hidden: false }))
    if (deck.coverPosition !== null) cards.splice(Math.max(0, Math.min(deck.coverPosition ?? 0, cards.length)), 0, { deckId: deck.id, cardId: 'cover', groupId: deck.id, hidden: false })
    return cards
  })
}
// Ignore stale/deleted references, deduplicate, and append newly added source cards.
export function resolveGuideCards(decks: GuidesV3DeckDetail[], saved: GuideCardPlacement[] = []): GuideCardPlacement[] {
  const defaults = defaultGuideCards(decks)
  const valid = new Map(defaults.map(card => [guideCardKey(card), card]))
  const groups = new Set(decks.map(deck => deck.id))
  const resolved: GuideCardPlacement[] = []
  let hasIndex = false
  for (const card of saved) {
    if (isGuideIndexCard(card)) {
      // At most one index; if its group deck left the guide, park it in the first deck.
      if (hasIndex || !decks.length) continue
      hasIndex = true
      resolved.push({ ...card, groupId: groups.has(card.groupId) ? card.groupId : decks[0].id, hidden: card.hidden === true })
      continue
    }
    const key = guideCardKey(card)
    if (!valid.has(key)) continue
    resolved.push({ ...card, groupId: groups.has(card.groupId) ? card.groupId : card.deckId, hidden: card.hidden === true })
    valid.delete(key)
  }
  resolved.push(...valid.values())
  return decks.flatMap(deck => resolved.filter(card => card.groupId === deck.id))
}
export function parseGuideCardLayout(value: unknown): GuideCardPlacement[] {
  if (!Array.isArray(value)) return []
  return value.filter((card): card is GuideCardPlacement => Boolean(card) && typeof card === 'object' && typeof card.deckId === 'string' && typeof card.cardId === 'string' && typeof card.groupId === 'string' && typeof card.hidden === 'boolean')
}

// Placeholder loadDeckDetail substitutes for a missing deck description.
export const EMPTY_DECK_DESCRIPTION = 'No description has been added to this deck yet.'

export type GuideIndexEntry = { deckId: string; title: string; subtitle: string | null; targetKey: string }
// One row per deck group (guide deck order) that still has a visible content
// card; the row targets that group's first visible card.
export function guideIndexEntries(decks: GuidesV3DeckDetail[], cards: GuideCardPlacement[]): GuideIndexEntry[] {
  const visible = cards.filter(card => !card.hidden && !isGuideIndexCard(card))
  return decks.flatMap(deck => {
    const first = visible.find(card => card.groupId === deck.id)
    if (!first) return []
    return [{ deckId: deck.id, title: deck.title, subtitle: deck.description && deck.description !== EMPTY_DECK_DESCRIPTION ? deck.description.trim() || null : null, targetKey: guideCardKey(first) }]
  })
}
