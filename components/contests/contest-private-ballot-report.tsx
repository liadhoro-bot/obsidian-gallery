import 'server-only'
import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { canReadContestBallots } from '../../lib/contests/permissions'
import { tallyBallots, type ReportBallot } from '../../lib/contests/ballot-report'
import type { ContestInvitedParticipant, ContestNomination } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

export default async function ContestPrivateBallotReport({ contestId, nominations, participants }: {
  contestId: string
  nominations: ContestNomination[]
  participants: ContestInvitedParticipant[]
}) {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user || !(await canReadContestBallots(user.id, contestId))) return null
  // Ordinary users retain own-ballot-only RLS. Owner/admin access is checked first.
  const { data, error } = await createServiceRoleClient().from('contest_ballots')
    .select('id, voter_user_id, status, submitted_at, contest_ballot_items(nomination_id, selection_rank, points_awarded)')
    .eq('contest_id', contestId).order('submitted_at')
  if (error) throw new Error('Could not load the private ballot report.')
  const ballots = (data ?? []) as ReportBallot[]
  const totals = tallyBallots(nominations, ballots)
  const submittedCount = ballots.filter((ballot) => ballot.status === 'submitted').length
  const title = (ballot: ReportBallot | undefined, rank: number) => {
    const item = ballot?.contest_ballot_items.find((selection) => selection.selection_rank === rank)
    return nominations.find((entry) => entry.id === item?.nomination_id)?.snapshot_title ?? '—'
  }
  return (
    <div className={styles.contestStack}>
      <section className={styles.paperPanel}>
        <p className={styles.eyebrow}>Private · Organizer only</p>
        <h2 className={styles.sectionTitle}>{submittedCount} of {participants.length} ballots cast</h2>
        <p className={styles.bodyText}>First place earns 2 points. Second place earns 1 point. Refresh this page for the latest totals. These are not published results.</p>
        {submittedCount === 0 ? <p className={styles.mutedText}>No votes have been submitted yet.</p> : null}
      </section>
      <section className={styles.paperPanel}>
        <h2 className={styles.sectionTitle}>Army totals</h2>
        <div className={styles.reportTableScroll}>
          <table className={styles.reportTable}>
            <caption className="sr-only">Army vote totals</caption>
            <thead><tr><th>Entry</th><th>1st</th><th>2nd</th><th>Points</th></tr></thead>
            <tbody>{totals.map((row) => <tr key={row.id}><th scope="row">{row.title}</th><td>{row.first}</td><td>{row.second}</td><td><strong>{row.points}</strong></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className={styles.paperPanel}>
        <h2 className={styles.sectionTitle}>Participant ballots</h2>
        <p className={styles.mutedText}>Only you and site administrators can see these choices.</p>
        <div className={styles.reportBallots}>
          {participants.map((participant) => {
            const ballot = ballots.find((row) => row.voter_user_id === participant.user_id)
            return <article key={participant.id} className={styles.reportBallot}>
              <h3>{participant.username || participant.email || participant.identifier}</h3>
              <p className={styles.mutedText}>{ballot?.status === 'submitted' ? 'Vote recorded' : ballot?.status ?? (participant.user_id ? 'Not voted yet' : 'Awaiting account signup')}</p>
              {ballot ? <dl className={styles.rulesList}>
                <div><dt>1st · 2 points</dt><dd>{title(ballot, 1)}</dd></div>
                <div><dt>2nd · 1 point</dt><dd>{title(ballot, 2)}</dd></div>
                <div><dt>Submitted</dt><dd>{ballot.submitted_at ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(ballot.submitted_at)) : '—'} (Israel time)</dd></div>
              </dl> : null}
            </article>
          })}
        </div>
      </section>
    </div>
  )
}
