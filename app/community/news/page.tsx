import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { NewsFeedTracker } from './news-client'
import { NewsPageHeader, NewsPageShell, NewsRow } from './news-components'
import {
  NEWS_FILTERS,
  newsCategoryLabels,
  newsFeedHref,
  parseNewsFilter,
  parseNewsPage,
} from './news-data'
import { getNewsFeed } from './news-queries'
import styles from './news.module.css'

export const metadata: Metadata = {
  title: 'Miniature Painting News | Obsidian Gallery',
  description:
    'New paint ranges, miniature releases, hobby tools and events, summarised from official announcements.',
}

export default async function NewsArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; page?: string | string[] }>
}) {
  const params = await searchParams
  const filter = parseNewsFilter(params.category)
  const page = parseNewsPage(params.page)
  const [feed, cookieStore] = await Promise.all([getNewsFeed(filter, page), cookies()])

  // Community itself needs a login, so visitors go back to the home page.
  const isMember = cookieStore.getAll().some(({ name }) => name.includes('-auth-token'))

  return (
    <NewsPageShell>
      <NewsFeedTracker surface="archive" category={filter} page={page} />
      <NewsPageHeader
        backHref={isMember ? '/community?tab=news' : '/'}
        backLabel={isMember ? 'Back to community' : 'Obsidian Gallery home'}
        title="News"
      />

      <nav className={styles.filters} aria-label="Filter news by category">
        <Link
          href={newsFeedHref(null)}
          className={styles.filter}
          aria-current={filter === null ? 'page' : undefined}
        >
          All
        </Link>
        {NEWS_FILTERS.map((option) => (
          <Link
            key={option}
            href={newsFeedHref(option)}
            className={styles.filter}
            aria-current={filter === option ? 'page' : undefined}
          >
            {newsCategoryLabels[option]}
          </Link>
        ))}
      </nav>

      <section data-v3-community-indicator="section-card" className="overflow-hidden">
        <div className="px-4 py-3">
          <h2 className="text-[10px] uppercase">
            {filter ? newsCategoryLabels[filter] : 'Latest News'}
          </h2>
        </div>
        <div className="divide-y">
          {feed.articles.length > 0 ? (
            feed.articles.map((article) => <NewsRow key={article.id} article={article} />)
          ) : (
            <p data-v3-community-indicator="events-empty" role="status">
              {feed.failed
                ? 'News could not be loaded. Please try again shortly.'
                : filter
                  ? `No ${newsCategoryLabels[filter].toLowerCase()} news yet. Check back soon.`
                  : 'No news yet. Check back soon.'}
            </p>
          )}
        </div>
      </section>

      {feed.hasMore ? (
        <Link href={newsFeedHref(filter, page + 1)} scroll={false} className={styles.showMore}>
          Show more
        </Link>
      ) : null}
    </NewsPageShell>
  )
}
