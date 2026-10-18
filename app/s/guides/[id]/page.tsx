import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { redirect } from 'next/navigation'
import DeckCardViewer from '@/app/guides/decks/[id]/deck-card-viewer'
import ViewCardsLink from '@/app/guides/shared/view-cards-link'
import DeckShareMenu from '@/app/guides/shared/deck-share-menu'
import { guideCardNodes } from '@/app/guides/shared/deck-card-entries'
import { guideCardKey, isGuideIndexCard, resolveGuideCards } from '@/app/guides/shared/guide-card-layout'
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
  searchParams?: Promise<{ view?: string; deck?: string }>
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

// Public share link for a guide. Members are sent to the full in-app guide;
// everyone else gets a fenced, read-only view (no app nav, no edit, no links
// into the rest of the app) with a login or subscribe dialog over it.
export default async function SharedGuidePage({ params, searchParams }: SharedGuidePageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { view?: string; deck?: string }),
  ])
  const isCardView = query.view === '1'

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
      const inApp = new URLSearchParams({ preview: '1' })
      if (isCardView) inApp.set('view', '1')
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
  const basePath = `/s/guides/${guide.id}`
  const gate = <SharedGuideGate guideId={guide.id} variant={variant} />

  if (isCardView) {
    const resolved = resolveGuideCards(deckDetails, guide.cardLayout)
    const entries = guideCardNodes(deckDetails, resolved)
    const visible = resolved.filter(card => !card.hidden)
    const cards = visible.map(card => ({ key: guideCardKey(card), node: entries.get(guideCardKey(card)) }))
    const firstCard = visible.find(card => !isGuideIndexCard(card) && card.groupId === query.deck)

    return (
      <main>
        <DeckCardViewer
          initialCardKey={firstCard ? guideCardKey(firstCard) : undefined}
          cards={cards}
          title={guide.title}
          backHref={basePath}
          featureGuides={featureGuides}
          heroActions={<>
            <DeckShareMenu cards={cards} fileBaseName={guide.title} sharePath={basePath} />
            {gate}
          </>}
        />
      </main>
    )
  }

  return (
    <main className={detailStyles.root}>
      <div className={detailStyles.shell}>
        <header className={detailStyles.topBar}>
          <span className={styles.brand}>Obsidian Gallery</span>
          {gate}
        </header>

        <div className="flex items-center gap-3 py-3">
          <ViewCardsLink href={`${basePath}?view=1`} title={guide.title} />
        </div>

        <section className={detailStyles.heroCard}>
          <div className={`${detailStyles.heroImage} ${detailStyles.guideHeroImage}`}>
            <Image
              src={guide.image}
              alt=""
              fill
              sizes="(max-width: 480px) 100vw, 420px"
              className="object-cover"
              priority
            />
            <div className={detailStyles.heroScrim} />
            <div className={detailStyles.heroContent}>
              <p className={detailStyles.eyebrow}>Shared guide</p>
              <h1 className={detailStyles.heroTitle}>{guide.title}</h1>
            </div>
          </div>
          <div className={detailStyles.statGrid}>
            <span>{guide.decks} {guide.decks === 1 ? 'deck' : 'decks'}</span>
            <span>{guide.cards} {guide.cards === 1 ? 'card' : 'cards'}</span>
            <span>{guide.level}</span>
          </div>
        </section>

        <section className={detailStyles.panel}>
          <h2 className={detailStyles.sectionHeading}>Description</h2>
          <p className={detailStyles.bodyText}>{guide.subtitle}</p>
        </section>

        <section className={`${detailStyles.panel} ${detailStyles.deckList}`}>
          <div className={detailStyles.panelHeader}>
            <h2 className={detailStyles.sectionHeading}>Decks In This Guide</h2>
          </div>
          <div className={detailStyles.rows}>
            {guide.decksList.map((deck) => (
              <div key={deck.id} className={detailStyles.deckRow}>
                <Link href={`${basePath}?view=1&deck=${deck.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={detailStyles.deckThumb}>
                    <Image src={deck.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <span className={detailStyles.deckText}>
                    <span className={detailStyles.deckTitle}>{deck.title}</span>
                    <span className={detailStyles.deckMeta}>{deck.cards} cards - {deck.paints} paints</span>
                  </span>
                </Link>
                <ViewCardsLink href={`${basePath}?view=1&deck=${deck.id}`} title={deck.title} />
              </div>
            ))}
          </div>
        </section>
      </div>
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
