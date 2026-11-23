// Copy for the onboarding notifications ask. 'live' is what new users see;
// 'proposed' waits for approval in /admin/onboarding.
export type NotificationsCopyVariant = 'live' | 'proposed'

export const NOTIFICATIONS_COPY: Record<
  NotificationsCopyVariant,
  { title: string; body: string[]; cta: string; skip: string }
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
    title: 'Keep your hobby moving',
    body: [
      'Get a useful reminder when a project stalls, a deadline is close, a saved Guide becomes relevant, or someone interacts with your work.',
      'No spam. You can change this anytime.',
    ],
    cta: 'Enable helpful painting reminders ->',
    skip: 'Not now',
  },
}
