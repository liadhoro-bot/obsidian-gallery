import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import DeckCardViewer from '@/app/guides/decks/[id]/deck-card-viewer'
import DeckShareMenu from '@/app/guides/shared/deck-share-menu'
import { guideCardNodes } from '@/app/guides/shared/deck-card-entries'
import { guideCardKey, isGuideOwnedCard, resolveGuideCards } from '@/app/guides/shared/guide-card-layout'
import { getSharedGuideDetail } from '@/app/guides/guides-v3-detail-data'
import { getFeatureGuidesForPage } from '@/app/components/feature-guide-data'
import { guideDetailFeatureGuides } from '@/app/components/feature-guide-presets'
import detailStyles from '@/app/guides/guide-detail-silver.module.css'
import { createClient, getSessionUser } from '@/utils/supabase/server'
import { getSupabaseImageUrl } from '@/utils/images/supabase-image'
import {
  getAccessState,
  getSubscriptionStatus,
  hasAppAccess,
  isSubscriptionGateEnabled,
} from '@/lib/subscription/subscription-guard'
import { isPricingV2Active } from '@/lib/subscription/pricing'
import SharedGuideGate, { type SharedGuideGateVariant } from './shared-guide-gate'
import styles from './shared-guide.module.css'

type SharedGuidePageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ deck?: string }>
}

export async function generateMetadata({ params }: SharedGuidePageProps): Promise<Metadata> {
  const { id } = await params
  const shared = await getSharedGuideDetail(id)
  if (!shared) return { title: 'Guide unavailable · Obsidian Gallery', robots: { index: false } }

  const ogImage = shared.coverImageUrl?.startsWith('http')
    ? getSupabaseImageUrl(shared.coverImageUrl, { width: 1200, height: 630, quality: 75, resize: 'cover' })
    : null

  return {
    title: `${shared.guide.title} · Obsidian Gallery`,
    description: shared.guide.subtitle,
    robots: { index: false, follow: false },
    openGraph: {
      title: shared.guide.title,
      description: shared.guide.subtitle,
      type: 'article',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
  }
}

// Public share link for a guide. It always opens straight into the card
// viewer (older ?view=1 links still work). Members are sent to the in-app
// viewer; everyone else gets a fenced, read-only viewer (no app nav, no back
// button, no links into the rest of the app) with a login, trial or
// subscribe dialog over it.
export default async function SharedGuidePage({ params, searchParams }: SharedGuidePageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { deck?: string }),
  ])

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  let variant: SharedGuideGateVariant = 'login'

  if (user) {
    // Mirrors the proxy's payment gate: subscribers, bypass and trialing users
    // are members; a user who never started a trial is offered one.
    let isMember = true
    if (isSubscriptionGateEnabled()) {
      if (isPricingV2Active()) {
        const access = await getAccessState(user)
        isMember = hasAppAccess(access)
        variant = access.status === 'trial_available' ? 'trial' : 'subscribe'
      } else {
        isMember = (await getSubscriptionStatus(user.email)).isActive
        variant = 'subscribe'
      }
    }

    if (isMember) {
      const inApp = new URLSearchParams({ preview: '1', view: '1' })
      if (query.deck) inApp.set('deck', query.deck)
      redirect(`/guides/${id}?${inApp.toString()}`)
    }
  }

  const [shared, featureGuides] = await Promise.all([
    getSharedGuideDetail(id),
    getFeatureGuidesForPage('/guides/[id]', guideDetailFeatureGuides),
  ])

  if (!shared) return <GuideUnavailable />

  const { guide, deckDetails } = shared
  const resolved = resolveGuideCards(deckDetails, guide.cardLayout)
  const entries = guideCardNodes(deckDetails, resolved, { id: guide.id, title: guide.title, description: guide.subtitle, image: shared.coverImageUrl ?? guide.image, isPublic: true })
  const visible = resolved.filter(card => !card.hidden)
  const cards = visible.map(card => ({ key: guideCardKey(card), node: entries.get(guideCardKey(card)) }))
  const firstCard = visible.find(card => !isGuideOwnedCard(card) && card.groupId === query.deck)

  return (
    <main>
      <DeckCardViewer
        initialCardKey={firstCard ? guideCardKey(firstCard) : undefined}
        cards={cards}
        title={guide.title}
        featureGuides={featureGuides}
        heroActions={<>
          <DeckShareMenu cards={cards} fileBaseName={guide.title} sharePath={`/s/guides/${guide.id}`} />
          <SharedGuideGate guideId={guide.id} variant={variant} />
        </>}
      />
    </main>
  )
}

function GuideUnavailable() {
  return (
    <main className={detailStyles.root}>
      <div className={detailStyles.shell}>
        <header className={detailStyles.topBar}>
          <span className={styles.brand}>Obsidian Gallery</span>
        </header>
        <section className={`${detailStyles.panel} mt-6`}>
          <h1 className={detailStyles.sectionHeading}>This guide isn&apos;t available</h1>
          <p className={`${detailStyles.bodyText} mb-5`}>
            It may be private, or its creator removed it.
          </p>
          <div className={styles.dialogActions}>
            <a href="/login?next=%2Fguides%3Fpreview%3D1&preview=1" className={styles.primaryAction}>Log in</a>
            <a href="/onboarding" className={styles.secondaryAction}>Try the app</a>
          </div>
        </section>
      </div>
    </main>
  )
}
