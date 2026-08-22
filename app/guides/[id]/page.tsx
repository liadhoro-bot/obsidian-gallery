import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import { hasV3PreviewSession } from '../../../lib/v3-preview-server'
import { createPerfTimer } from '../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { getGuidesV3GuideDetail } from '../guides-v3-detail-data'
import styles from '../guide-detail-silver.module.css'

type GuideDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ preview?: string }>
}

export default async function GuideDetailPage({
  params,
  searchParams,
}: GuideDetailPageProps) {
  const perf = createPerfTimer('/guides/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { preview?: string }),
  ])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  if (!isPreview) {
    redirect('/recipes')
  }

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
          <span className={styles.topSpacer} aria-hidden="true" />
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
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>
                Guide Detail
              </p>
              <h1 className={styles.heroTitle}>
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

        <section className={styles.panel}>
          <h2 className={styles.sectionHeading}>
            Description
          </h2>
          <p className={styles.bodyText}>
            {guide.subtitle}
          </p>
          <div className={styles.paletteRow}>
            {guide.palette.map((color, index) => (
              <span
                key={`${guide.id}-${color}-${index}`}
                className={styles.swatch}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.deckList}`}>
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
