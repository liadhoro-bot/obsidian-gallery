import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import ApprovalBallot from '../../../../components/contests/approval-ballot'
import RankedBallot from '../../../../components/contests/ranked-ballot'
import { submitBallotAction } from '../../../../lib/contests/actions'
import { getContestPhase } from '../../../../lib/contests/phases'
import {
  getContestBySlug,
  getContestNominations,
  getViewerBallot,
} from '../../../../lib/contests/queries'
import { canManageContest } from '../../../../lib/contests/permissions'

export default async function ContestVotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ submitted?: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  if (
    contest.visibility === 'private' &&
    !(await canManageContest(user.id, contest.id))
  ) {
    notFound()
  }

  const phase = getContestPhase(contest)
  const nominations = await getContestNominations(contest.id)
  const ballot = await getViewerBallot(contest.id, user.id)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-6 sm:max-w-5xl">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Vote
          </p>
          <h1 className="mt-2 text-3xl font-black">{contest.title}</h1>
        </header>

        {query.submitted ? (
          <p className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">
            Your ballot has been recorded.
            {contest.allow_ballot_changes ? ' You may revise it until voting closes.' : ''}
          </p>
        ) : null}

        {phase !== 'voting_open' ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
            Voting is not open.
          </p>
        ) : ballot?.status === 'submitted' && !contest.allow_ballot_changes ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/60">
            You already submitted a locked ballot.
          </p>
        ) : contest.voting_method === 'ranked' ? (
          <RankedBallot contest={contest} nominations={nominations} action={submitBallotAction} />
        ) : (
          <ApprovalBallot contest={contest} nominations={nominations} action={submitBallotAction} />
        )}
      </div>
    </main>
  )
}
