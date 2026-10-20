// A guide is listed (Discover) only because its owner made that guide itself
// public. Placing guides inside a public guide makes their cards readable
// there, but never lists those building blocks on their own.
//
// Publishing a guide flips its member decks to public, and the
// recipes_ensure_guide trigger wraps each newly public deck in an auto-guide.
// Those auto-guides are building blocks, not guides the owner published.

import type { GuideVisibility } from './guide-visibility'

type ListedGuide = { id: string; is_auto: boolean | null; guide_decks?: { recipe_id: string }[] | null }

// Drops every auto-guide whose deck is also inside another (non-auto) guide -
// public or not. `composedGuideIdsByDeck` maps a deck to the composed guides
// that contain it, across all owners and visibilities.
export function withoutNestedAutoGuides<T extends ListedGuide>(
  guides: T[],
  composedGuideIdsByDeck: Map<string, Set<string>>
): T[] {
  return guides.filter((guide) => {
    if (!guide.is_auto) return true
    return !(guide.guide_decks ?? []).some((deck) =>
      [...(composedGuideIdsByDeck.get(deck.recipe_id) ?? [])].some((parentId) => parentId !== guide.id)
    )
  })
}

// Visibility of the guide a deck becomes when it is opened as a guide. An
// explicit choice (the Forge's Status) wins. Otherwise an auto-guide keeps
// "public" only when its deck was published on its own - a deck that is
// public because it sits inside another guide stays an unlisted building
// block. A brand-new guide is never public by default.
export function upgradedGuideVisibility({
  explicit,
  autoGuideVisibility,
  nestedInOtherGuide,
}: {
  explicit?: GuideVisibility
  autoGuideVisibility?: GuideVisibility
  nestedInOtherGuide: boolean
}): GuideVisibility {
  if (explicit) return explicit
  if (autoGuideVisibility === 'public') return nestedInOtherGuide ? 'private' : 'public'
  return autoGuideVisibility ?? 'private'
}
