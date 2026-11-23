// Copy for the onboarding notifications ask. 'live' is what new users see.
// To try new copy, set 'proposed': /admin/onboarding then shows it next to
// the live screen for approval. null = nothing waiting.
export type NotificationsCopyVariant = 'live' | 'proposed'

export type NotificationsCopy = { title: string; body: string[]; note?: string; cta: string; skip: string }

export const NOTIFICATIONS_COPY: { live: NotificationsCopy; proposed: NotificationsCopy | null } = {
  // Approved 23 Nov 2026.
  live: {
    title: 'A little nudge to keep painting',
    body: [
      'Life gets busy. Get a gentle reminder to pick up your brush, stay on track with your projects, and see when fellow painters appreciate your work.',
    ],
    note: "Only useful updates. No noise. You're always in control.",
    cta: 'Keep my hobby moving ->',
    skip: 'Not now',
  },
  proposed: null,
}
