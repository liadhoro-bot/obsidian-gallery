import { notFound } from 'next/navigation'
import ContestHeader from '../../../components/contests/contest-header'
import ContestDetailTabs from '../../../components/contests/contest-detail-tabs'
import { getContestPhase } from '../../../lib/contests/phases'
import {
  DEMO_CONTEST_ID,
  getContestBySlug,
  getContestNominations,
  getContestResults,
  getNominationPickerSources,
  getUserContestNominations,
  getViewerBallot,
} from '../../../lib/contests/queries'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { canManageContest, canViewContest } from '../../../lib/contests/permissions'
import type { ContestNomination } from '../../../lib/contests/types'
import styles from '../../../components/contests/contest-v3-silver.module.css'

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  const isDemoContest = contest.id === DEMO_CONTEST_ID
  const canManage = Boolean(user) && (await canManageContest(user!.id, contest.id))
  const canView = isDemoContest || (await canViewContest(user?.id, contest.id))

  if (!canView) {
    notFound()
  }

  const phase = getContestPhase(contest)
  const allowedTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const nominations = isDemoContest && user
    ? await getDemoNominations(user.id, contest.id, allowedTypes)
    : await getContestNominations(contest.id)
  const results = isDemoContest ? [] : await getContestResults(contest.id)
  const userNominations = user
    ? isDemoContest
      ? nominations.filter((nomination) => nomination.owner_user_id === user.id)
      : await getUserContestNominations(contest.id, user.id)
    : []
  const ballot = user && !isDemoContest ? await getViewerBallot(contest.id, user.id) : null
  const hideIdentity =
    contest.hide_nominee_identity_during_voting && phase === 'voting_open'

  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <ContestHeader
          backHref="/community"
          backLabel="Back"
          contest={contest}
          manageHref={canManage ? `/contests/manage/${contest.id}` : undefined}
          showFooter={false}
        />

        <ContestDetailTabs
          ballot={ballot}
          contest={contest}
          nominations={nominations}
          results={results}
          userNominations={userNominations}
          hideIdentity={hideIdentity}
        />
      </div>
    </main>
  )
}

async function getDemoNominations(
  userId: string,
  contestId: string,
  allowedTypes: Array<'project' | 'unit' | 'guide'>
) {
  const sources = await getNominationPickerSources(userId, allowedTypes)

  return sources.slice(0, 8).map((source, index) => ({
    id: `demo-nomination-${source.sourceType}-${source.id}`,
    contest_id: contestId,
    submitted_by_user_id: userId,
    owner_user_id: userId,
    source_type: source.sourceType,
    source_project_id: source.sourceType === 'project' ? source.id : null,
    source_unit_id: source.sourceType === 'unit' ? source.id : null,
    source_guide_id: source.sourceType === 'guide' ? source.id : null,
    snapshot_title: source.title,
    snapshot_description: source.description,
    snapshot_image_url: source.imageUrl || '/onboarding/welcome-hero.jpeg',
    snapshot_owner_display_name: 'You',
    snapshot_metadata: { demo: true },
    status: 'approved',
    submitted_at: new Date(Date.now() - index * 3600000).toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
    withdrawn_at: null,
    disqualified_at: null,
    disqualification_reason: null,
  })) satisfies ContestNomination[]
}
