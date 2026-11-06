import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { ChevronIcon, EventsPageHeader } from '../event-components'
import communityStyles from '../community-v3-silver.module.css'
import { NewsArticleTracker, NewsShareButton, NewsSourceLink } from './news-client'
import {
  formatNewsAge,
  formatNewsDate,
  getNewsSourceLabel,
  newsArticleHref,
  newsCategoryLabels,
  splitParagraphs,
  type NewsArticle,
  type NewsCategory,
} from './news-data'
import styles from './news.module.css'

const categoryIconPaths: Record<Exclude<NewsCategory, 'og_announcement'>, React.ReactNode> = {
  paints: (
    <>
      <path d="M9 3h6v3l1.5 2.5V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V8.5L9 6V3Z" />
      <path d="M7.5 13h9" />
    </>
  ),
  miniatures: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M8 21v-5l-1-4 5-2 5 2-1 4v5" />
      <path d="M5 21h14" />
    </>
  ),
  tools: (
    <>
      <path d="m14 4 6 6-3 3-6-6 3-3Z" />
      <path d="M11 7 4 14c-1 1-1 3 0 4l2 2c1 1 3 1 4 0l7-7" />
    </>
  ),
  events: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
}

// Shown when an article has no image cleared for use.
function NewsFallbackArt({ category, large = false }: { category: NewsCategory; large?: boolean }) {
  return (
    <span className={styles.fallbackArt} data-large={large || undefined} aria-hidden="true">
      <span className={styles.fallbackPlate}>
        {category === 'og_announcement' ? (
          <Image src="/icon-192.png" alt="" width={large ? 44 : 28} height={large ? 44 : 28} />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {categoryIconPaths[category]}
          </svg>
        )}
      </span>
    </span>
  )
}

export function NewsBadge({ category }: { category: NewsCategory }) {
  return (
    <span className={styles.badge} data-official={category === 'og_announcement' || undefined}>
      {newsCategoryLabels[category]}
    </span>
  )
}

export function NewsRow({ article }: { article: NewsArticle }) {
  const source = getNewsSourceLabel(article)

  return (
    <Link href={newsArticleHref(article.slug)} className={styles.row}>
      <span className={styles.thumb}>
        {article.imageUrl ? (
          <Image src={article.imageUrl} alt="" fill sizes="72px" className="object-cover" />
        ) : (
          <NewsFallbackArt category={article.category} />
        )}
      </span>
      <span className={styles.rowBody}>
        <NewsBadge category={article.category} />
        <span className={styles.rowHeadline}>{article.headline}</span>
        <span className={styles.rowExcerpt}>{article.summary}</span>
        <span className={styles.rowMeta}>
          {source ? <span className={styles.rowSource}>{source}</span> : null}
          {article.publishedAt ? (
            <time dateTime={article.publishedAt} suppressHydrationWarning>
              {formatNewsAge(article.publishedAt)}
            </time>
          ) : null}
        </span>
      </span>
    </Link>
  )
}

export { EventsPageHeader as NewsPageHeader }

export function NewsPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={communityStyles.communitySilver}>
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-community-indicator="content"
      >
        {children}
      </div>
    </main>
  )
}

// The article body, shared by the public page and the Newsroom preview so a
// preview can't drift from what readers get.
export function NewsArticleView({
  article,
  preview = false,
}: {
  article: NewsArticle
  preview?: boolean
}) {
  const isOfficial = article.category === 'og_announcement'
  const attribution = article.sourceName || article.manufacturer

  return (
    <>
      {preview ? null : (
        <NewsArticleTracker
          slug={article.slug}
          category={article.category}
          manufacturer={article.manufacturer}
        />
      )}

      <article className={styles.article}>
        <div className={styles.articlePhoto}>
          {article.imageUrl ? (
            <Image
              src={article.imageUrl}
              alt={article.imageAlt ?? ''}
              fill
              priority
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
            />
          ) : (
            <NewsFallbackArt category={article.category} large />
          )}
        </div>

        <div className={styles.articleBody}>
          <div className={styles.articleTags}>
            <NewsBadge category={article.category} />
            {article.manufacturer ? (
              <span className={styles.articleManufacturer}>{article.manufacturer}</span>
            ) : null}
          </div>

          <h2 className={styles.articleHeadline} dir="auto">
            {article.headline}
          </h2>

          <div className={styles.articleSummary}>
            {splitParagraphs(article.summary).map((paragraph, index) => (
              <p key={index} dir="auto">
                {paragraph}
              </p>
            ))}
          </div>

          {article.whyPaintersCare ? (
            <aside className={styles.whyCare}>
              <h3>Why painters care</h3>
              <p dir="auto">{article.whyPaintersCare}</p>
            </aside>
          ) : null}

          <div className={styles.articleActions}>
            {article.sourceUrl ? (
              <NewsSourceLink
                href={article.sourceUrl}
                slug={article.slug}
                sourceName={article.sourceName}
                className={styles.primaryAction}
              >
                Read original announcement
                <ChevronIcon />
              </NewsSourceLink>
            ) : null}
            {preview ? null : (
              <NewsShareButton slug={article.slug} headline={article.headline} />
            )}
          </div>

          <dl className={styles.articleDates}>
            {isOfficial ? (
              <div>
                <dt>From</dt>
                <dd>Official Obsidian Gallery announcement</dd>
              </div>
            ) : null}
            {article.sourcePublishedAt ? (
              <div>
                <dt>{attribution ? `Announced by ${attribution}` : 'Announced'}</dt>
                <dd>{formatNewsDate(article.sourcePublishedAt)}</dd>
              </div>
            ) : null}
            {article.publishedAt ? (
              <div>
                <dt>{isOfficial ? 'Published' : 'Summarised by Obsidian Gallery'}</dt>
                <dd>{formatNewsDate(article.publishedAt)}</dd>
              </div>
            ) : null}
            {article.imageCredit ? (
              <div>
                <dt>Image</dt>
                <dd>{article.imageCredit}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </article>
    </>
  )
}
