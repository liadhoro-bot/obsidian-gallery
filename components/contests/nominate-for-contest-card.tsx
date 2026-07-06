import Link from 'next/link'
import type {
  Contest,
  ContestNomination,
  ContestNomineeType,
} from '../../lib/contests/types'

export default function NominateForContestCard({
  contests,
  sourceType,
  sourceId,
}: {
  contests: Array<Contest & { nominations?: ContestNomination[] }>
  sourceType: ContestNomineeType
  sourceId: string
}) {
  const sourceLabel =
    sourceType === 'guide'
      ? 'Guide'
      : sourceType === 'project'
        ? 'Project'
        : 'Unit'

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
      <h2 className="text-lg font-black text-white">Nominate for a Contest</h2>
      {contests.length === 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-sm font-semibold text-white/75">
            No open contests currently accept this {sourceLabel.toLowerCase()}.
          </p>
          <Link
            href="/contests"
            className="mt-3 inline-flex rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-100"
          >
            Browse Contests
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {contests.map((contest) => (
            <ContestNominationLink
              key={contest.id}
              contest={contest}
              sourceType={sourceType}
              sourceId={sourceId}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ContestNominationLink({
  contest,
  sourceType,
  sourceId,
}: {
  contest: Contest & { nominations?: ContestNomination[] }
  sourceType: ContestNomineeType
  sourceId: string
}) {
  const nomination = contest.nominations?.[0]

  return (
    <Link
      href={`/contests/${contest.slug}/submit?sourceType=${sourceType}&sourceId=${sourceId}`}
      className="block rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-cyan-300/40"
    >
      <div className="font-bold text-white">{contest.title}</div>
      {nomination ? (
        <div className="text-xs text-cyan-100/75">
          Nominated in: {contest.title}. Status: {nomination.status}
        </div>
      ) : (
        <div className="text-xs text-white/45">
          Nominations close{' '}
          {new Date(contest.submissions_close_at).toLocaleDateString()}
        </div>
      )}
    </Link>
  )
}
