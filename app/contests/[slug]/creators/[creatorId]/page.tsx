import Link from '@/app/components/navigation-feedback/navigation-link'
import { notFound } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../../utils/supabase/service-role'
import {
  getContestBySlug,
  getContestCreatorProfiles,
  getPublicContestBySlug,
  getPublicGuideCreatorLeaderboard,
  getViewerBallot,
} from '../../../../../lib/contests/queries'
import { canViewContest } from '../../../../../lib/contests/permissions'
import { getNomineeType, GUIDE_CREATOR_CONTEST_SLUG } from '../../../../../lib/contests/nominee-copy'
import { getContestPhase } from '../../../../../lib/contests/phases'
import {
  getAccessState,
  getSubscriptionStatus,
  hasAppAccess,
  isSubscriptionGateEnabled,
} from '../../../../../lib/subscription/subscription-guard'
import { isPricingV2Active } from '../../../../../lib/subscription/pricing'
import { getCreatorPublicGuides } from '../../../../guides/guides-v3-data'
import { CompactGuideCard, LibrarySection, SharedCompactGuideCard } from '../../../../guides/shared/discover-guide-list'
import CreatorVoteCta, { type CreatorVoteState } from '../../../../../components/contests/creator-vote-cta'
import CreatorPageGate, { type CreatorPageGateVariant } from '../../../../../components/contests/creator-page-gate'
import styles from '../../../../guides/guides-v3-silver.module.css'
import contestStyles from '../../../../../components/contests/contest-v3-silver.module.css'

// A contest creator page is public, like a shared guide link (the proxy lets
// it through without a session). Members get the full page and can vote;
// logged-out visitors and accounts without a trial or paid access get a
// read-only view with a login / trial dialog, and its vote buttons open it.
export default async function ContestCreatorGuidesPage({ params, searchParams }: {
  params: Promise<{ slug: string; creatorId: string }>
  searchParams: Promise<{ ballotPreview?: string }>
}) {
  const { slug, creatorId } = await params
  const { ballotPreview } = await searchParams
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) notFound()
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  // Mirrors the proxy's payment gate, like the shared guide page.
  let gateVariant: CreatorPageGateVariant | null = user ? null : 'login'
  if (user && isSubscriptionGateEnabled()) {
    if (isPricingV2Active()) {
      const access = await getAccessState(user)
      if (!hasAppAccess(access)) gateVariant = access.status === 'trial_available' ? 'trial' : 'subscribe'
    } else if (!(await getSubscriptionStatus(user.email)).isActive) {
      gateVariant = 'subscribe'
    }
  }
  const isMember = Boolean(user) && !gateVariant

  const contest = isMember ? await getContestBySlug(slug) : await getPublicContestBySlug(slug)
  if (!contest || getNomineeType(contest) !== 'guide') notFound()
  if (isMember && !(await canViewContest(user!.id, contest.id))) notFound()

  const phase = getContestPhase(contest)
  const hideIdentity = contest.hide_nominee_identity_during_voting && phase === 'voting_open'
  const isCreatorVote = contest.slug === GUIDE_CREATOR_CONTEST_SLUG
  const viewerId = user?.id ?? ''
  const [guides, creatorProfiles, creators, ballot] = await Promise.all([
    getCreatorPublicGuides(creatorId, viewerId, { shared: !isMember }),
    getContestCreatorProfiles(contest.id),
    isCreatorVote ? getPublicGuideCreatorLeaderboard(hideIdentity, user?.id, contest.id, !isMember) : Promise.resolve([]),
    isCreatorVote && isMember ? getViewerBallot(contest.id, viewerId) : Promise.resolve(null),
  ])
  let creatorName = 'Creator'
  if (guides.length > 0 && !hideIdentity) {
    const { data: profile, error } = await createServiceRoleClient()
      .from('profiles').select('username').eq('id', creatorId).maybeSingle()
    if (error) throw new Error(error.message)
    creatorName = profile?.username || creatorName
  }
  const description = hideIdentity ? null : creatorProfiles.get(creatorId)?.description
  // Guides the organizer ordered come first, in that order; the rest keep theirs.
  const guideOrder = creatorProfiles.get(creatorId)?.guideOrder ?? []
  const orderedGuides = guideOrder.length
    ? [...guides].sort((first, second) => {
      const a = guideOrder.indexOf(first.id)
      const b = guideOrder.indexOf(second.id)
      return (a === -1 ? guideOrder.length : a) - (b === -1 ? guideOrder.length : b)
    })
    : guides
  const returnPath = `/contests/${contest.slug}/creators/${creatorId}`
  const gate = gateVariant ? { variant: gateVariant, returnPath, creatorName } : undefined
  // Visitors can't open the Entries tab yet, so send them straight to the
  // (V3) login, trial or subscribe step, which then returns them there.
  const entriesPath = `/contests/${contest.slug}?tab=entries`
  const entriesNext = encodeURIComponent(entriesPath)
  const entriesHref = gateVariant === 'login' ? `/login?next=${entriesNext}&preview=1`
    : gateVariant === 'trial' ? `/trial?next=${entriesNext}`
      : gateVariant === 'subscribe' ? `/subscribe?next=${entriesNext}`
        : entriesPath

  // Dev-only preview lets the ballot be tried before voting opens; it never records a vote.
  const preview = process.env.NODE_ENV === 'development' && ballotPreview === '1'
  const isEntry = creators.some((creator) => creator.ownerId === creatorId)
  const showVote = isCreatorVote && isEntry && creatorId !== user?.id
    && (phase === 'voting_open' || phase === 'moderation' || phase === 'submissions_open' || preview)
  const voteState: CreatorVoteState = ballot?.status === 'submitted' ? 'voted'
    : phase === 'voting_open' || preview ? 'open' : 'not_open'
  const opensLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jerusalem',
  }).format(new Date(contest.voting_open_at))
  const voteCta = showVote ? (
    <CreatorVoteCta contest={contest} creators={creators} creatorId={creatorId} creatorName={creatorName}
      state={voteState} opensLabel={opensLabel} preview={preview} gate={gate} />
  ) : null

  return (
    <main className={styles.guidesSilver}>
      <div data-v3-guides-indicator="content" className="grid gap-4 pt-4">
        <header className={contestStyles.detailsHeader} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <div className="flex items-center justify-between gap-3">
            <Link href={entriesHref} className={contestStyles.heroBackLink}>
              Back to entries
            </Link>
            {gate ? <CreatorPageGate {...gate} /> : null}
          </div>
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
          {orderedGuides.length ? orderedGuides.map((guide) => isMember
            ? <CompactGuideCard key={guide.id} guide={guide} />
            : <SharedCompactGuideCard key={guide.id} guide={guide} />) : (
            <p className="px-4 py-6 text-sm">This creator has no public guides right now.</p>
          )}
        </LibrarySection>
        {voteCta}
      </div>
    </main>
  )
}
