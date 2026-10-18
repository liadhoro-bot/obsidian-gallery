// The deck a guide's likes, saves and Saved Guides membership are keyed to:
// its pinned guides.primary_recipe_id while that deck is still a member,
// otherwise its first member deck (the behavior before the pin existed, and
// the fallback when the column is not deployed yet).
export function socialDeckIdOf(primaryRecipeId: string | null | undefined, memberDeckIds: string[]) {
  return primaryRecipeId && memberDeckIds.includes(primaryRecipeId) ? primaryRecipeId : memberDeckIds[0]
}
