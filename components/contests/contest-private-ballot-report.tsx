import 'server-only'
import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { canManageContest } from '../../lib/contests/permissions'
import { tallyBallots, type ReportBallot } from '../../lib/contests/ballot-report'
import type { ContestInvitedParticipant, ContestNomination } from '../../lib/contests/types'

export default async function ContestPrivateBallotReport({ contestId, nominations, participants }: {
  contestId: string
  nominations: ContestNomination[]
  participants: ContestInvitedParticipant[]
}) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user || !(await canManageContest(user.id, contestId))) return null
  // Ordinary users retain own-ballot-only RLS. Admin access is checked before using the service client.
  const { data, error } = await createServiceRoleClient().from('contest_ballots')
    .select('id, voter_user_id, status, submitted_at, contest_ballot_items(nomination_id, selection_rank, points_awarded)')
    .eq('contest_id', contestId).order('submitted_at')
  if (error) throw new Error('Could not load the private ballot report.')
  const ballots = (data ?? []) as ReportBallot[]
  const totals = tallyBallots(nominations, ballots)
  const title = (ballot: ReportBallot | undefined, rank: number) => {
    const item = ballot?.contest_ballot_items.find((selection) => selection.selection_rank === rank)
    return nominations.find((entry) => entry.id === item?.nomination_id)?.snapshot_title ?? '—'
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-xl font-black">Private voting report</h2>
      <p className="my-3 text-sm text-white/60">Admin only · {ballots.filter((ballot) => ballot.status === 'submitted').length} ballots submitted · {participants.length} invited participants. First place: 2 points. Second place: 1 point.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm [&_th]:p-2 [&_td]:p-2">
          <caption className="text-left font-bold">Army totals</caption>
          <thead><tr><th>Entry</th><th>1st votes</th><th>2nd votes</th><th>Points</th></tr></thead>
          <tbody>{totals.map((row) => <tr key={row.id}><td>{row.title}</td><td>{row.first}</td><td>{row.second}</td><td>{row.points}</td></tr>)}</tbody>
        </table>
        <table className="mt-6 w-full text-left text-sm [&_th]:p-2 [&_td]:p-2">
          <caption className="text-left font-bold">Participant ballots</caption>
          <thead><tr><th>Participant</th><th>Status</th><th>1st · 2 points</th><th>2nd · 1 point</th><th>Submitted (Israel time)</th></tr></thead>
          <tbody>{participants.map((participant) => {
            const ballot = ballots.find((row) => row.voter_user_id === participant.user_id)
            return <tr key={participant.id}>
              <td>{participant.username || participant.email || participant.identifier}</td>
              <td>{ballot?.status ?? (participant.user_id ? 'Not voted' : 'Pending account')}</td>
              <td>{title(ballot, 1)}</td><td>{title(ballot, 2)}</td>
              <td>{ballot?.submitted_at ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(ballot.submitted_at)) : '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </section>
  )
}
