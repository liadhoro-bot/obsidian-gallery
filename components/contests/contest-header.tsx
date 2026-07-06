import Image from 'next/image'
import Link from 'next/link'
import { getContestCountdownTarget, getContestPhase } from '../../lib/contests/phases'
import type { Contest } from '../../lib/contests/types'
import ContestCountdown from './contest-countdown'
import ContestPhaseBadge from './contest-phase-badge'

export default function ContestHeader({
  contest,
  manageHref,
}: {
  contest: Contest
  manageHref?: string
}) {
  const phase = getContestPhase(contest)
  const allowedTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type).join(', ') ||
    'entries'
  const ctaHref =
    phase === 'submissions_open'
      ? `/contests/${contest.slug}/submit`
      : phase === 'voting_open'
        ? `/contests/${contest.slug}/vote`
        : phase === 'results_published'
          ? `/contests/${contest.slug}/results`
          : `/contests/${contest.slug}`
  const ctaLabel =
    phase === 'submissions_open'
      ? 'Submit a Nomination'
      : phase === 'voting_open'
        ? 'Cast My Votes'
        : phase === 'results_published'
          ? 'View Results'
          : 'View Details'

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
      <div className="relative min-h-64 bg-[#0b1622] sm:min-h-72">
        {contest.cover_image_url ? (
          <Image
            src={contest.cover_image_url}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 760px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-black/35 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <ContestPhaseBadge phase={phase} />
          <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl">
            {contest.title}
          </h1>
          {contest.short_description ? (
            <p className="mt-2 max-w-2xl text-sm text-white/70">
              {contest.short_description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <ContestCountdown
            phase={phase}
            target={getContestCountdownTarget(contest, phase)}
          />
          <p className="text-sm capitalize text-white/50">
            Accepting {allowedTypes.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:items-center">
          {manageHref ? (
            <Link
              href={manageHref}
              className="tap-press inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100"
            >
              Edit Contest
            </Link>
          ) : null}
          <Link
            href={ctaHref}
            className="tap-press inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-black"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
