import { notFound, redirect } from 'next/navigation'
import Link from '@/app/components/navigation-feedback/navigation-link'
import ContestPrivateBallotReport from '../../../../components/contests/contest-private-ballot-report'
import { getContestBySlug } from '../../../../lib/contests/queries'
import { canReadContestBallots } from '../../../../lib/contests/permissions'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import type { ContestInvitedParticipant, ContestNomination } from '../../../../lib/contests/types'
import styles from '../../../../components/contests/contest-v3-silver.module.css'

export const dynamic = 'force-dynamic'

export default async function ContestReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await getSessionUser(await createClient())
  if (!user) redirect(`/login?next=${encodeURIComponent(`/contests/${slug}/report`)}`)
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()
  if (!(await canReadContestBallots(user.id, contest.id))) {
    return (
      <main className={styles.contestSilver}><div className={styles.pageRail}>
        <section className={styles.paperPanel}>
          <h1 className={styles.sectionTitle}>This report is private</h1>
          <p className={styles.bodyText}>Sign in with the contest owner’s account to see ballots and totals. Participants can view their own vote in My Activity.</p>
          <Link className={styles.brassButton} href={`/contests/${contest.slug}?tab=my-activity`}>Back to My Activity</Link>
        </section>
      </div></main>
    )
  }
  // Only read the private participant list after the owner/admin access check.
  const db = createServiceRoleClient()
  const [nominations, participants] = await Promise.all([
    db.from('contest_nominations').select('*').eq('contest_id', contest.id),
    db.from('contest_invited_participants').select('*').eq('contest_id', contest.id).neq('status', 'removed').order('created_at'),
  ])
  if (nominations.error || participants.error) throw new Error('Could not load the contest report.')
  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <header className={styles.detailsHeader}>
          <Link href={`/contests/${contest.slug}?tab=my-activity`} className={styles.heroBackLink}>Back</Link>
          <h1>Voting Report</h1><span aria-hidden="true" />
        </header>
        <p className={styles.reportContestTitle}>{contest.title}</p>
        <ContestPrivateBallotReport contestId={contest.id}
          nominations={(nominations.data ?? []) as ContestNomination[]}
          participants={(participants.data ?? []) as ContestInvitedParticipant[]} />
      </div>
    </main>
  )
}
