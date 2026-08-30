import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { submitNominationAction } from '../../../../lib/contests/actions'
import { getContestPhase } from '../../../../lib/contests/phases'
import {
  DEMO_CONTEST_ID,
  getContestBySlug,
  getNominationPickerSources,
} from '../../../../lib/contests/queries'
import ContestHeader from '../../../../components/contests/contest-header'
import NominationSourcePicker from '../../../../components/contests/nomination-source-picker'
import { canViewContest } from '../../../../lib/contests/permissions'
import styles from '../../../../components/contests/contest-v3-silver.module.css'

export default async function ContestSubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ sourceType?: string; sourceId?: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login')

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  const phase = getContestPhase(contest)
  const allowedTypes = contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const isDemoContest = contest.id === DEMO_CONTEST_ID
  const canView = isDemoContest || (await canViewContest(user.id, contest.id))
  if (!canView) {
    notFound()
  }

  if (phase !== 'submissions_open') {
    return (
      <main className={styles.contestSilver}>
        <div className={styles.pageRail}>
          <ContestHeader
            backHref={`/contests/${contest.slug}`}
            backLabel="Back"
            contest={contest}
            showFooter={false}
          />

          <article className={`${styles.paperPanel} ${styles.closedPanel}`}>
            <p className={styles.eyebrow}>Nomination</p>
            <h2 className={styles.sectionTitle}>Submissions Closed</h2>
            <p className={styles.bodyText}>
              This contest is not accepting new nominations right now.
            </p>
          </article>
        </div>
      </main>
    )
  }

  const sources = await getNominationPickerSources(user.id, allowedTypes)

  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <ContestHeader
          backHref={`/contests/${contest.slug}`}
          backLabel="Back"
          contest={contest}
          showFooter={false}
        />

        <div className={styles.contentGrid}>
          <NominationSourcePicker
            contest={contest}
            sources={sources}
            selectedSourceType={query.sourceType}
            selectedSourceId={query.sourceId}
            action={submitNominationAction}
            isDemoContest={isDemoContest}
          />
        </div>
      </div>
    </main>
  )
}
