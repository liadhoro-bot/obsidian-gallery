export type GuideDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export const GUIDE_DIFFICULTIES: GuideDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']

export function isGuideDifficulty(value: unknown): value is GuideDifficulty {
  return GUIDE_DIFFICULTIES.includes(value as GuideDifficulty)
}

// A guide with no saved difficulty is rated by its size. The editor's
// dropdown and the guide's info page both use this, so they always agree.
export function inferGuideDifficulty(cardCount: number): GuideDifficulty {
  if (cardCount >= 12) return 'Advanced'
  if (cardCount >= 6) return 'Intermediate'
  return 'Beginner'
}

export function guideDifficulty(saved: string | null | undefined, cardCount: number): GuideDifficulty {
  return isGuideDifficulty(saved) ? saved : inferGuideDifficulty(cardCount)
}
