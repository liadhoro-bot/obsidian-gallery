import type { ContestPhase } from '../../lib/contests/types'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

export default function ContestCountdown({
  phase,
  target,
}: {
  phase: ContestPhase
  target: string | null
}) {
  if (!target) return null

  const label =
    phase === 'upcoming'
      ? 'Submissions open'
      : phase === 'submissions_open'
        ? 'Submissions close'
        : phase === 'moderation'
          ? 'Voting opens'
          : phase === 'voting_open'
            ? 'Voting closes'
            : 'Updated'

  return (
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
      {label} {formatDate(target)}
    </span>
  )
}
