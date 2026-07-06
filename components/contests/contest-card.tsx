import Image from 'next/image'
import Link from 'next/link'
import { getContestCountdownTarget, getContestPhase } from '../../lib/contests/phases'
import type { Contest } from '../../lib/contests/types'
import ContestCountdown from './contest-countdown'
import ContestPhaseBadge from './contest-phase-badge'

function getCta(contest: Contest) {
  const phase = getContestPhase(contest)
  if (phase === 'submissions_open') return 'Submit a Nomination'
  if (phase === 'voting_open') return 'Cast My Votes'
  if (phase === 'results_published') return 'View Results'
  return 'View Contest'
}

export default function ContestCard({ contest }: { contest: Contest }) {
  const phase = getContestPhase(contest)
  const nomineeTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type).join(', ') ||
    'Community entries'

  return (
    <Link
      href={`/contests/${contest.slug}`}
      className="tap-card overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-white shadow-sm transition hover:border-cyan-300/35"
    >
      <div className="relative aspect-[16/9] bg-[#0b1622]">
        {contest.cover_image_url ? (
          <Image
            src={contest.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <ContestPhaseBadge phase={phase} />
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h2 className="text-xl font-black leading-tight">{contest.title}</h2>
          {contest.short_description ? (
            <p className="mt-1 line-clamp-2 text-sm text-white/55">
              {contest.short_description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-white/55">
          <span className="rounded-full border border-white/10 px-2 py-1 capitalize">
            {nomineeTypes.replaceAll('_', ' ')}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-1 capitalize">
            {contest.voting_method}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <ContestCountdown
            phase={phase}
            target={getContestCountdownTarget(contest, phase)}
          />
          <span className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-black">
            {getCta(contest)}
          </span>
        </div>
      </div>
    </Link>
  )
}
