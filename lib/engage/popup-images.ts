// Photos a popup can carry, picked per message in /admin/engage
// (engagement_messages.image_path; null means no photo).

export const POPUP_IMAGE_LIBRARY: readonly { src: string; label: string }[] = [
  { src: '/onboarding/welcome-hero.jpeg', label: 'Welcome hero' },
  { src: '/onboarding/problem-desk.jpeg', label: 'Busy desk' },
  { src: '/onboarding/first-project-bg.jpeg', label: 'First project' },
  { src: '/onboarding/pains/pile-of-shame.jpeg', label: 'Pile of shame' },
  { src: '/onboarding/pains/scheme-loss.jpeg', label: 'Scheme loss' },
  { src: '/onboarding/pains/fragmentation.jpeg', label: 'Fragmentation' },
  { src: '/onboarding/pains/paint-management.jpeg', label: 'Paint management' },
  { src: '/onboarding/pains/tough-choices.jpeg', label: 'Tough choices' },
]

// What each popup showed before the choice moved to the database. Used only
// while the image_path column does not exist yet.
const LEGACY_DEFAULTS: Record<string, string> = {
  push_opt_in_popup: '/onboarding/welcome-hero.jpeg',
  push_opt_in_return_popup: '/onboarding/pains/pile-of-shame.jpeg',
  session_next_step_popup: '/onboarding/problem-desk.jpeg',
  saved_guide_assign_popup: '/onboarding/pains/scheme-loss.jpeg',
}

export function isLibraryImage(src: string) {
  return POPUP_IMAGE_LIBRARY.some((image) => image.src === src)
}

/** The photo a popup shows, or null for none. */
export function popupImageOf(message: { key: string; surface: string; image_path?: string | null }) {
  if (message.surface !== 'popup') return null
  if (message.image_path === undefined) return LEGACY_DEFAULTS[message.key] ?? null
  return message.image_path
}
