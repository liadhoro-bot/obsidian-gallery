import DeckCardViewer from '../decks/[id]/deck-card-viewer'
import ViewCardsLink from '../shared/view-cards-link'
import { deckCardEntries } from '../shared/deck-card-entries'
import { guideCardKey, resolveGuideCards } from '../shared/guide-card-layout'
import GuideBackButton from '../shared/guide-back-button'
import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { notFound, redirect } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import FeatureGuideLauncher from '../../components/feature-guide-launcher'
import { getFeatureGuidesForPage } from '../../components/feature-guide-data'
import { guideDetailFeatureGuides } from '../../components/feature-guide-presets'
import { createPerfTimer } from '../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { getGuidesV3Payload } from '../guides-v3-data'
import { getGuidesV3DeckDetail, getGuidesV3GuideDetail } from '../guides-v3-detail-data'
import GuideSocialActions from '../shared/guide-social-actions'
import GuideEditPageClient from './guide-edit-page-client'
import styles from '../guide-detail-silver.module.css'

type GuideDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ edit?: string; view?: string; deck?: string }>
}

export default async function GuideDetailPage({
  params,
  searchParams,
}: GuideDetailPageProps) {
  const perf = createPerfTimer('/guides/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { edit?: string; view?: string; deck?: string }),
  ])
  const isEditing = resolvedSearchParams.edit === '1'

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    const nextPath = isEditing
      ? `/guides/${id}?preview=1&edit=1`
      : `/guides/${id}?preview=1${resolvedSearchParams.view === '1' ? '&view=1' : ''}`

    redirect(`/login?next=${encodeURIComponent(nextPath)}&preview=1`)
  }

  const guide = await perf.measure('v3 guide detail data', () =>
    getGuidesV3GuideDetail(id, user.id)
  )
  const featureGuides = await getFeatureGuidesForPage(
    '/guides/[id]',
    guideDetailFeatureGuides
  )
  perf.total()

  if (!guide) notFound()

  if (isEditing && !guide.isOwner) {
    // Only the creator may edit a guide. A viewer who merely saved/bookmarked
    // it gets bounced to the read-only view instead of the editor.
    redirect(`/guides/${id}?preview=1`)
  }

  if (isEditing) {
    const deckIds = guide.deckIds ?? []
    const payload = await getGuidesV3Payload(user.id)
    const deckDetails = await Promise.all(deckIds.map(deckId => getGuidesV3DeckDetail(deckId, user.id)))

    const memberDeckIds = new Set(deckIds)
    const availableDecks = payload.decks.filter(
      (deck) => deck.isOwner && !memberDeckIds.has(deck.id)
    )
    const resolvedDeckDetails = deckDetails.filter(
      (deck): deck is NonNullable<typeof deck> => Boolean(deck)
    )
    const primaryDeckDetail = resolvedDeckDetails.find((deck) => deck.id === deckIds[0])
    const initialCoverImage = guide.image || primaryDeckDetail?.fullImage || primaryDeckDetail?.image

    return (
      <main>
        <V3PerfIndicator surface="guide-editor" detail="main" />
        <GuideEditPageClient
          guide={guide}
          memberDecks={guide.decksList}
          availableDecks={availableDecks}
          deckDetails={resolvedDeckDetails}
          initialCoverImage={initialCoverImage}
          featureGuides={featureGuides}
        />
      </main>
    )
  }

  if (resolvedSearchParams.view === '1') {
    const details = (await Promise.all((guide.deckIds ?? []).map(deckId => getGuidesV3DeckDetail(deckId, user.id)))).filter((deck): deck is NonNullable<typeof deck> => Boolean(deck))
    const entries = new Map(details.flatMap(deck => deckCardEntries(deck).map(card => [deck.id + ':' + card.key, card.node] as const)))
    const cards = resolveGuideCards(details, guide.cardLayout).filter(card => !card.hidden).map(card => ({ key: guideCardKey(card), node: entries.get(guideCardKey(card)) }))
    const firstCard = resolveGuideCards(details, guide.cardLayout).find(card => !card.hidden && card.groupId === resolvedSearchParams.deck)
    return <main><DeckCardViewer initialCardKey={firstCard ? guideCardKey(firstCard) : undefined} cards={cards} title={guide.title} backHref={`/guides/${guide.id}?preview=1`} featureGuides={featureGuides} heroActions={<>
      <Link href={`/guides/${guide.id}?preview=1`} className={styles.backButton}>Info</Link>
      {guide.isOwner ? <Link href={`/guides/${guide.id}?preview=1&edit=1`} className={styles.backButton}>Edit</Link> : null}
    </>} /></main>
  }

  return (
    <main className={styles.root}>
      <V3PerfIndicator surface="guide-detail" detail="main" />
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <GuideBackButton className={styles.backButton} />
          <span className={styles.topLabel}>
            Guide
          </span>
          <FeatureGuideLauncher
            buttonClassName={styles.backButton}
            guides={featureGuides}
            label="Show guide detail explanation"
          />
        </header>

        <div className="flex items-center gap-3 py-3"><ViewCardsLink href={`/guides/${guide.id}?preview=1&view=1`} title={guide.title} />{guide.isOwner ? <Link href={`/guides/${guide.id}?preview=1&edit=1`}>Edit</Link> : null}</div>
        <section className={styles.heroCard}>
          <div className={`${styles.heroImage} ${styles.guideHeroImage}`}>
            <Image
              src={guide.image}
              alt=""
              fill
              sizes="(max-width: 480px) 100vw, 420px"
              className="object-cover"
              priority
            />
            <div className={styles.heroScrim} />
            {guide.deckId ? (
              <GuideSocialActions
                recipeId={guide.deckId}
                likeCount={guide.likeCount}
                saveCount={guide.saveCount}
                viewerHasLiked={guide.viewerHasLiked}
                viewerHasSaved={guide.viewerHasSaved}
                className="absolute right-3 top-3 z-10"
              />
            ) : null}
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>
                Guide Detail
              </p>
              <h1
                className={styles.heroTitle}
                data-feature-guide-target="guides.detail.page"
              >
                {guide.title}
              </h1>
            </div>
          </div>
          <div className={styles.statGrid}>
            <span>{guide.decks} {guide.decks === 1 ? 'deck' : 'decks'}</span>
            <span>
              {guide.cards} {guide.cards === 1 ? 'card' : 'cards'}
            </span>
            <span>{guide.level}</span>
          </div>
        </section>

        <section
          className={styles.panel}
          data-feature-guide-target="guides.detail.description"
        >
          <h2 className={styles.sectionHeading}>
            Description
          </h2>
          <p className={styles.bodyText}>
            {guide.subtitle}
          </p>
        </section>

        <section
          className={`${styles.panel} ${styles.deckList}`}
          data-feature-guide-target="guides.detail.decks"
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.sectionHeading}>
              Decks In This Guide
            </h2>
          </div>
          <div className={styles.rows}>
            {guide.decksList.length ? (
              guide.decksList.map((deck) => (
                <div key={deck.id} className={styles.deckRow}>
                <Link href={`/guides/${guide.id}?preview=1&view=1&deck=${deck.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={styles.deckThumb}>
                    <Image
                      src={deck.image}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </span>
                  <span className={styles.deckText}>
                    <span className={styles.deckTitle}>
                      {deck.title}
                    </span>
                    <span className={styles.deckMeta}>
                      {deck.cards} cards - {deck.paints} paints
                    </span>
                  </span>
                </Link>
                <ViewCardsLink href={`/guides/${guide.id}?preview=1&view=1&deck=${deck.id}`} title={deck.title} />
                {deck.isOwner ? <Link href={`/guides/decks/${deck.id}?preview=1&edit=1`}>Edit</Link> : null}
                </div>
              ))
            ) : (
              <div className={styles.emptyPanel}>
                No decks have been added yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
