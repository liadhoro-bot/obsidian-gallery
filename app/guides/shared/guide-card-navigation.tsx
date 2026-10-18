'use client'

import { createContext, useContext } from 'react'

// Lets a card ask its host (the paged card viewer, or the editor's scrolling
// preview) to bring another card into view by its guideCardKey. Absent when a
// card renders outside a navigable host, e.g. a share/export image.
export type GuideCardNavigation = { goToCard: (key: string) => void }

export const GuideCardNavigationContext = createContext<GuideCardNavigation | null>(null)

export function useGuideCardNavigation() {
  return useContext(GuideCardNavigationContext)
}
