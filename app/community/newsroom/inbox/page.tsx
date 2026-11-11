import type { Metadata } from 'next'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { NewsPageHeader, NewsPageShell } from '../../news/news-components'
import styles from '../../news/news.module.css'
import { requireNewsroomAccess } from '../guard'
import { getInboxItems, INBOX_FILTERS, parseInboxFilter } from '../inbox-queries'
import InboxItemCard from '../inbox-item'
import { NewsroomTabs } from '../newsroom-tabs'

export const metadata: Metadata = { title: 'News inbox | Obsidian Gallery', robots: { index: false } }

// Server Actions on this page can start a draft; give them room.
export const maxDuration = 30

export default async function NewsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireNewsroomAccess()
  const filter = parseInboxFilter((await searchParams).filter)
  const { items, failed } = await getInboxItems(filter)

  return (
    <NewsPageShell>
      <NewsPageHeader backHref="/community?tab=news" backLabel="Back to community" title="Newsroom" />
      <NewsroomTabs active="inbox" />

      <nav className={styles.filters} data-columns="4" aria-label="Filter collected items">
        {INBOX_FILTERS.map((option) => (
          <Link
            key={option.id}
            href={option.id === 'new' ? '/community/newsroom/inbox' : `/community/newsroom/inbox?filter=${option.id}`}
            className={styles.filter}
            aria-current={filter === option.id ? 'page' : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <section data-v3-community-indicator="section-card" className="overflow-hidden">
        <div className="grid gap-1 px-4 py-3">
          <h2 className="text-[10px] uppercase">Collected announcements</h2>
          <p className={styles.inboxNote}>
            Headlines and links from approved sources. Read the original before writing, and write the
            summary in your own words.
          </p>
        </div>
        <div className="divide-y">
          {failed ? (
            <p data-v3-community-indicator="events-empty">The inbox couldn&apos;t be loaded. Try again.</p>
          ) : items.length > 0 ? (
            items.map((item) => <InboxItemCard key={item.id} item={item} />)
          ) : (
            <p data-v3-community-indicator="events-empty">
              {filter === 'new'
                ? 'Nothing new to review. Sources are checked every few hours.'
                : 'Nothing here.'}
            </p>
          )}
        </div>
      </section>
    </NewsPageShell>
  )
}
