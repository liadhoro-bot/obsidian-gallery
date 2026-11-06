import type { Metadata } from 'next'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { NewsBadge, NewsPageHeader, NewsPageShell } from '../news/news-components'
import { formatNewsDate, getNewsAvailability, type NewsAvailability } from '../news/news-data'
import { getNewsroomArticles } from '../news/news-queries'
import styles from '../news/news.module.css'
import { requireNewsroomAccess } from './guard'

export const metadata: Metadata = { title: 'Newsroom | Obsidian Gallery', robots: { index: false } }

const statusFilters: Array<{ id: NewsAvailability | null; label: string }> = [
  { id: null, label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'live', label: 'Live' },
  { id: 'retracted', label: 'Retracted' },
]

export default async function NewsroomPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireNewsroomAccess()
  const { status } = await searchParams
  const activeFilter = statusFilters.find((filter) => filter.id === status)?.id ?? null
  const articles = (await getNewsroomArticles())
    .map((article) => ({ article, availability: getNewsAvailability(article) }))
    .filter(({ availability }) => activeFilter === null || availability === activeFilter)

  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community?tab=news" backLabel="Back to community" title="Newsroom" />

      <Link href="/community/newsroom/new" className={styles.primaryAction}>
        New article
      </Link>

      <nav className={styles.filters} aria-label="Filter articles by status">
        {statusFilters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.id ? `/community/newsroom?status=${filter.id}` : '/community/newsroom'}
            className={styles.filter}
            aria-current={activeFilter === filter.id ? 'page' : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <section data-v3-community-indicator="section-card" className="overflow-hidden">
        <div className="px-4 py-3">
          <h2 className="text-[10px] uppercase">Articles</h2>
        </div>
        <div className="divide-y">
          {articles.length > 0 ? (
            articles.map(({ article, availability }) => (
              <Link
                key={article.id}
                href={`/community/newsroom/${article.id}`}
                className={styles.newsroomRow}
              >
                <span className={styles.newsroomRowTop}>
                  <NewsBadge category={article.category} />
                  <span className={styles.statusPill} data-status={availability}>
                    {availability}
                  </span>
                </span>
                <span className={styles.rowHeadline}>{article.headline}</span>
                <span className={styles.rowMeta}>
                  {availability === 'scheduled' || availability === 'live'
                    ? formatNewsDate(article.publishedAt as string)
                    : `Edited ${formatNewsDate(article.updatedAt)}`}
                </span>
              </Link>
            ))
          ) : (
            <p data-v3-community-indicator="events-empty">No articles here yet.</p>
          )}
        </div>
      </section>
    </NewsPageShell>
  )
}
