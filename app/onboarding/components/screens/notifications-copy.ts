// Copy for the onboarding notifications ask. 'live' is what new users see;
// 'proposed' waits for approval in /admin/onboarding.
export type NotificationsCopyVariant = 'live' | 'proposed'

export const NOTIFICATIONS_COPY: Record<
  NotificationsCopyVariant,
  { title: string; body: string[]; note?: string; cta: string; skip: string }
> = {
  live: {
    title: 'Stay on top of your bench',
    body: [
      'Get a nudge before the painting sessions you schedule, plus the odd update from the community. You can turn this off anytime in Settings.',
    ],
    cta: 'Turn on notifications ->',
    skip: 'Not now',
  },
  proposed: {
    title: 'A little nudge to keep painting',
    body: [
      'Life gets busy. Get a gentle reminder to pick up your brush, stay on track with your projects, and see when fellow painters appreciate your work.',
    ],
    note: "Only useful updates. No noise. You're always in control.",
    cta: 'Keep my hobby moving ->',
    skip: 'Not now',
  },
}
