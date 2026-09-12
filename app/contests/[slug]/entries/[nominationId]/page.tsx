import { notFound } from 'next/navigation'
import ContestHeader from '../../../../../components/contests/contest-header'
import ContestNomineeDetail from '../../../../../components/contests/contest-nominee-detail'
import { getContestPhase } from '../../../../../lib/contests/phases'
import {
  getContestBySlug,
  getContestNominationById,
  getEntityGalleryImages,
  withLiveNomineeData,
} from '../../../../../lib/contests/queries'
import { canViewContest } from '../../../../../lib/contests/permissions'
import { createClient, getSessionUser } from '../../../../../utils/supabase/server'
import styles from '../../../../../components/contests/contest-v3-silver.module.css'

export default async function ContestEntryDetailPage({
  params,
}: {
  params: Promise<{ slug: string; nominationId: string }>
}) {
  const { slug, nominationId } = await params
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const contest = await getContestBySlug(slug)
  if (!contest) notFound()

  if (!(await canViewContest(user?.id, contest.id))) {
    notFound()
  }

  const rawNomination = await getContestNominationById(nominationId)
  if (!rawNomination || rawNomination.contest_id !== contest.id) notFound()
  const [nomination] = await withLiveNomineeData([rawNomination])

  const isOwner = user?.id === nomination.owner_user_id
  if (nomination.status !== 'approved' && !isOwner) notFound()

  const hideIdentity =
    contest.hide_nominee_identity_during_voting && getContestPhase(contest) === 'voting_open'

  const galleryImages =
    nomination.source_type === 'project' && nomination.source_project_id
      ? await getEntityGalleryImages('project', nomination.source_project_id)
      : nomination.source_type === 'unit' && nomination.source_unit_id
        ? await getEntityGalleryImages('unit', nomination.source_unit_id)
        : []

  return (
    <main className={styles.contestSilver}>
      <div className={styles.pageRail}>
        <ContestHeader
          backHref={`/contests/${contest.slug}`}
          backLabel="Back"
          contest={contest}
          showFooter={false}
        />

        <ContestNomineeDetail
          nomination={nomination}
          galleryImages={galleryImages}
          hideIdentity={hideIdentity}
        />
      </div>
    </main>
  )
}
