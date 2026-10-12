import Link from '@/app/components/navigation-feedback/navigation-link'
import { notFound, redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import { getCreatorPublicGuides } from '../../guides-v3-data'
import { CompactGuideCard, LibrarySection } from '../../shared/discover-guide-list'
import styles from '../../guides-v3-silver.module.css'
import contestStyles from '../../../../components/contests/contest-v3-silver.module.css'

// Every public guide by one creator, opened from the creator row on Discover
// and saved-guide cards. Mirrors the contest creator page without needing a
// contest the viewer can see.
export default async function CreatorGuidesPage({ params }: {
  params: Promise<{ creatorId: string }>
}) {
  const { creatorId } = await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creatorId)) notFound()
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect(`/login?next=${encodeURIComponent(`/guides/creators/${creatorId}`)}`)

  const guides = await getCreatorPublicGuides(creatorId, user.id)
  // Profiles are private under RLS; only reveal the username of someone who
  // has public guides.
  let creatorName = 'Creator'
  if (guides.length > 0) {
    const { data: profile, error } = await createServiceRoleClient()
      .from('profiles').select('username').eq('id', creatorId).maybeSingle()
    if (error) throw new Error(error.message)
    creatorName = profile?.username || creatorName
  }

  return (
    <main className={styles.guidesSilver}>
      <div data-v3-guides-indicator="content" className="grid gap-4 pt-4">
        <header className={contestStyles.detailsHeader} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <Link href="/guides?preview=1&tab=library" className={contestStyles.heroBackLink} style={{ justifySelf: 'start' }}>
            Back to Discover
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
