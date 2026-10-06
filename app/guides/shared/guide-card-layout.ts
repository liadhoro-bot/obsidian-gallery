import type { GuidesV3DeckDetail } from '../guides-v3-detail-data'

// References belong to a guide. No source recipe or recipe_step is mutated.
export type GuideCardPlacement = { deckId: string; cardId: string; groupId: string; hidden: boolean }
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
  for (const card of saved) {
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
