import Link from '@/app/components/navigation-feedback/navigation-link'
import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../../utils/supabase/service-role'
import { getContestBySlug } from '../../../../../lib/contests/queries'
import { canViewContest } from '../../../../../lib/contests/permissions'
import { getNomineeType } from '../../../../../lib/contests/nominee-copy'
import { getContestPhase } from '../../../../../lib/contests/phases'
import { getCreatorPublicGuides } from '../../../../guides/guides-v3-data'
import { CompactGuideCard, LibrarySection } from '../../../../guides/shared/discover-guide-list'
import styles from '../../../../guides/guides-v3-silver.module.css'
import contestStyles from '../../../../../components/contests/contest-v3-silver.module.css'

export default async function ContestCreatorGuidesPage({ params }: {
  params: Promise<{ slug: string; creatorId: string }>
}) {
  const { slug, creatorId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) notFound()
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect(`/login?next=${encodeURIComponent(`/contests/${slug}/creators/${creatorId}`)}`)
  const contest = await getContestBySlug(slug)
  if (!contest || getNomineeType(contest) !== 'guide' || !(await canViewContest(user.id, contest.id))) notFound()

  const guides = await getCreatorPublicGuides(creatorId, user.id)
  const hideIdentity = contest.hide_nominee_identity_during_voting && getContestPhase(contest) === 'voting_open'
  let creatorName = 'Creator'
  if (guides.length > 0 && !hideIdentity) {
    const { data: profile, error } = await createServiceRoleClient()
      .from('profiles').select('username').eq('id', creatorId).maybeSingle()
    if (error) throw new Error(error.message)
    creatorName = profile?.username || creatorName
  }

  return (
    <main className={styles.guidesSilver}>
      <div data-v3-guides-indicator="content" className="grid gap-4 pt-4">
        <header className={contestStyles.detailsHeader} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <Link href={`/contests/${contest.slug}?tab=entries`} className={contestStyles.heroBackLink} style={{ justifySelf: 'start' }}>
            Back to entries
          </Link>
          <h1 style={{ textAlign: 'left', overflowWrap: 'anywhere' }}>{creatorName}&apos;s Guides</h1>
        </header>
        <LibrarySection title="Public Guides">
          {guides.length ? guides.map((guide) => <CompactGuideCard key={guide.id} guide={guide} />) : (
            <p className="px-4 py-6 text-sm">This creator has no public guides right now.</p>
          )}
        </LibrarySection>
      </div>
    </main>
  )
}
