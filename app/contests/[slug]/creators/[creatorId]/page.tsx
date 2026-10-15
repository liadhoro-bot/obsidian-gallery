import Link from '@/app/components/navigation-feedback/navigation-link'
import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../../utils/supabase/service-role'
import {
  getContestBySlug,
  getContestCreatorProfiles,
  getPublicGuideCreatorLeaderboard,
  getViewerBallot,
} from '../../../../../lib/contests/queries'
import { canViewContest } from '../../../../../lib/contests/permissions'
import { getNomineeType, GUIDE_CREATOR_CONTEST_SLUG } from '../../../../../lib/contests/nominee-copy'
import { getContestPhase } from '../../../../../lib/contests/phases'
import { getCreatorPublicGuides } from '../../../../guides/guides-v3-data'
import { CompactGuideCard, LibrarySection } from '../../../../guides/shared/discover-guide-list'
import CreatorVoteCta, { type CreatorVoteState } from '../../../../../components/contests/creator-vote-cta'
import styles from '../../../../guides/guides-v3-silver.module.css'
import contestStyles from '../../../../../components/contests/contest-v3-silver.module.css'

export default async function ContestCreatorGuidesPage({ params, searchParams }: {
  params: Promise<{ slug: string; creatorId: string }>
  searchParams: Promise<{ ballotPreview?: string }>
}) {
  const { slug, creatorId } = await params
  const { ballotPreview } = await searchParams
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) notFound()
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect(`/login?next=${encodeURIComponent(`/contests/${slug}/creators/${creatorId}`)}`)
  const contest = await getContestBySlug(slug)
  if (!contest || getNomineeType(contest) !== 'guide' || !(await canViewContest(user.id, contest.id))) notFound()

  const phase = getContestPhase(contest)
  const hideIdentity = contest.hide_nominee_identity_during_voting && phase === 'voting_open'
  const isCreatorVote = contest.slug === GUIDE_CREATOR_CONTEST_SLUG
  const [guides, creatorProfiles, creators, ballot] = await Promise.all([
    getCreatorPublicGuides(creatorId, user.id),
    getContestCreatorProfiles(contest.id),
    isCreatorVote ? getPublicGuideCreatorLeaderboard(hideIdentity, user.id, contest.id) : Promise.resolve([]),
    isCreatorVote ? getViewerBallot(contest.id, user.id) : Promise.resolve(null),
  ])
  let creatorName = 'Creator'
  if (guides.length > 0 && !hideIdentity) {
    const { data: profile, error } = await createServiceRoleClient()
      .from('profiles').select('username').eq('id', creatorId).maybeSingle()
    if (error) throw new Error(error.message)
    creatorName = profile?.username || creatorName
  }
  const description = hideIdentity ? null : creatorProfiles.get(creatorId)?.description

  // Dev-only preview lets the ballot be tried before voting opens; it never records a vote.
  const preview = process.env.NODE_ENV === 'development' && ballotPreview === '1'
  const isEntry = creators.some((creator) => creator.ownerId === creatorId)
  const showVote = isCreatorVote && isEntry && creatorId !== user.id
    && (phase === 'voting_open' || phase === 'moderation' || phase === 'submissions_open' || preview)
  const voteState: CreatorVoteState = ballot?.status === 'submitted' ? 'voted'
    : phase === 'voting_open' || preview ? 'open' : 'not_open'
  const opensLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
  }).format(new Date(contest.voting_open_at))
  const voteCta = showVote ? (
    <CreatorVoteCta contest={contest} creators={creators} creatorId={creatorId} creatorName={creatorName}
      state={voteState} opensLabel={opensLabel} preview={preview} />
  ) : null

  return (
    <main className={styles.guidesSilver}>
      <div data-v3-guides-indicator="content" className="grid gap-4 pt-4">
        <header className={contestStyles.detailsHeader} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <Link href={`/contests/${contest.slug}?tab=entries`} className={contestStyles.heroBackLink} style={{ justifySelf: 'start' }}>
            Back to entries
          </Link>
          <h1 style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{creatorName}&apos;s Guides</h1>
        </header>
        {description ? (
          <article className={contestStyles.paperPanel}>
            <p className={contestStyles.eyebrow}>About {creatorName}</p>
            <p className={`${contestStyles.bodyText} ${contestStyles.creatorDescription}`}>{description}</p>
          </article>
        ) : null}
        {voteCta}
        <LibrarySection title="Public Guides">
          {guides.length ? guides.map((guide) => <CompactGuideCard key={guide.id} guide={guide} />) : (
            <p className="px-4 py-6 text-sm">This creator has no public guides right now.</p>
          )}
        </LibrarySection>
        {voteCta}
      </div>
    </main>
  )
}
