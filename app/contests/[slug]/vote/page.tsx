import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import ContestCreatorBallot from '../../../../components/contests/contest-creator-ballot'
import { submitBallotAction } from '../../../../lib/contests/actions'
import { getContestPhase } from '../../../../lib/contests/phases'
import {
  getContestBySlug,
  getContestNominations,
  getViewerBallot,
} from '../../../../lib/contests/queries'
import { canNominateInContest, canViewContest } from '../../../../lib/contests/permissions'
import { getNomineeCopy } from '../../../../lib/contests/nominee-copy'
import styles from '../../../../components/contests/contest-v3-silver.module.css'

export default async function ContestVotePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ creator?: string; submitted?: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  if (!(await canViewContest(user.id, contest.id))) {
    notFound()
  }

  const phase = getContestPhase(contest)
  const nominations = await getContestNominations(contest.id)
  const ballot = await getViewerBallot(contest.id, user.id)
  const canVote = await canNominateInContest(user.id, contest)
  const nomineeCopy = getNomineeCopy(contest)

  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <header className={styles.detailsHeader}>
          <Link href={`/contests/${contest.slug}`} className={styles.heroBackLink}>
            Back
          </Link>
          <h1>Choose Winners</h1>
          <span aria-hidden="true" />
        </header>

        {query.submitted ? (
          <article className={`${styles.paperPanel} ${styles.closedPanel}`}>
            <p className={styles.eyebrow}>Your Vote</p>
            <p className={styles.bodyText}>
              Your ballot has been recorded.
              {contest.allow_ballot_changes ? ' You may revise it until voting closes.' : ''}
            </p>
          </article>
        ) : null}

        {!canVote ? (
          <article className={`${styles.paperPanel} ${styles.closedPanel}`}>
            <p className={styles.eyebrow}>Your Vote</p>
            <h2 className={styles.sectionTitle}>Voting is limited to invited participants.</h2>
            <p className={styles.bodyText}>
              You haven&apos;t been added to the participant list for this contest.
            </p>
          </article>
        ) : phase !== 'voting_open' ? (
          <article className={`${styles.paperPanel} ${styles.closedPanel}`}>
            <p className={styles.eyebrow}>Your Vote</p>
            <h2 className={styles.sectionTitle}>Voting is not open.</h2>
            <p className={styles.bodyText}>
              You will be able to choose one {nomineeCopy.voteNoun} for 1st place and one different{' '}
              {nomineeCopy.voteNoun} for 2nd place once community voting begins.
            </p>
          </article>
        ) : ballot?.status === 'submitted' && !contest.allow_ballot_changes ? (
          <article className={`${styles.paperPanel} ${styles.closedPanel}`}>
            <p className={styles.eyebrow}>Your Vote</p>
            <h2 className={styles.sectionTitle}>Ballot cast</h2>
            <p className={styles.bodyText}>Your ballot is locked for this contest.</p>
          </article>
        ) : (
          <ContestCreatorBallot
            contest={contest}
            nominations={nominations}
            action={submitBallotAction}
            initialCreatorId={query.creator}
            viewerUserId={user.id}
          />
        )}
      </div>
    </main>
  )
}
