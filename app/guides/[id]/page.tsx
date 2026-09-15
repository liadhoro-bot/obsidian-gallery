import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import FeatureGuideLauncher from '../../components/feature-guide-launcher'
import { getFeatureGuidesForPage } from '../../components/feature-guide-data'
import { guideDetailFeatureGuides } from '../../components/feature-guide-presets'
import { createPerfTimer } from '../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { getGuidesV3GuideDetail } from '../guides-v3-detail-data'
import GuideSocialActions from '../shared/guide-social-actions'
import styles from '../guide-detail-silver.module.css'

type GuideDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function GuideDetailPage({
  params,
}: GuideDetailPageProps) {
  const perf = createPerfTimer('/guides/[id]')
  const { id } = await params

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/guides/${id}?preview=1`)}&preview=1`
    )
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

  return (
    <main className={styles.root}>
      <V3PerfIndicator surface="guide-detail" detail="main" />
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <Link
            href="/guides?preview=1"
            className={styles.backButton}
            aria-label="Back to guides"
          >
            <span>&lt;</span>
          </Link>
          <span className={styles.topLabel}>
            Guide
          </span>
          <FeatureGuideLauncher
            buttonClassName={styles.backButton}
            guides={featureGuides}
            label="Show guide detail explanation"
          />
        </header>

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
            <span>{guide.decks} decks</span>
            <span>
              {guide.cards} cards
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
                <Link
                  key={deck.id}
                  href={`/guides/decks/${deck.id}?preview=1`}
                  className={styles.deckRow}
                >
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
                  <span className={styles.chevron}>&gt;</span>
                </Link>
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
