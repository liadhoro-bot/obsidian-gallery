'use client'

import Link from '@/app/components/navigation-feedback/navigation-link'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { useState, useTransition } from 'react'
import { formatNewsDate } from '../news/news-data'
import styles from '../news/news.module.css'
import { dismissInboxItem, restoreInboxItem, startDraftFromItem, type InboxActionResult } from './inbox-actions'
import type { InboxItem } from './inbox-queries'

const relevanceLabels: Record<InboxItem['relevance'], string> = {
  relevant: 'Likely news',
  maybe: 'Possible',
  irrelevant: 'Low match',
}

export default function InboxItemCard({ item }: { item: InboxItem }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function act(action: () => Promise<InboxActionResult>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
      } else if (result.articleId) {
        router.push(`/community/newsroom/${result.articleId}`)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <article className={styles.inboxItem}>
      {item.thumbnailUrl ? (
        <a
          href={item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.inboxThumb}
          aria-label="Watch the official video"
        >
          {/* YouTube's own thumbnail, shown from YouTube: the article embeds this video. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <span className={styles.playBadge} aria-hidden="true" />
        </a>
      ) : null}
      <span className={styles.newsroomRowTop}>
        <span className={styles.rowMeta}>
          <span>{item.sourceName}</span>
          <span>{formatNewsDate(item.publishedAt ?? item.discoveredAt)}</span>
        </span>
        <span className={styles.statusPill} data-status={item.relevance}>
          {relevanceLabels[item.relevance]}
        </span>
      </span>

      {/* Collected text is untrusted: it's only ever shown as plain text. */}
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.inboxTitle}>
        {item.title}
      </a>
      {item.excerpt ? (
        <p className={styles.rowExcerpt}>
          <span className={styles.inboxLabel}>What they say: </span>
          {item.excerpt}
        </p>
      ) : item.isTip ? (
        <p className={styles.inboxNote}>Tip-off: headline only. Open it to read, then write your own two sentences.</p>
      ) : null}
      {item.alsoReportedBy.length > 0 ? (
        <p className={styles.inboxNote}>Also reported by {item.alsoReportedBy.join(', ')}</p>
      ) : null}

      {error ? (
        <p className={styles.editorMessage} data-tone="error" role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.inboxActions}>
        {item.state === 'new' ? (
          <>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={isPending}
              onClick={() => act(() => startDraftFromItem(item.id))}
            >
              Start draft
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              disabled={isPending}
              onClick={() => act(() => dismissInboxItem(item.id))}
            >
              Dismiss
            </button>
          </>
        ) : null}
        {item.state === 'dismissed' ? (
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={isPending}
            onClick={() => act(() => restoreInboxItem(item.id))}
          >
            Restore
          </button>
        ) : null}
        {item.state === 'drafted' && item.articleId ? (
          <Link href={`/community/newsroom/${item.articleId}`} className={styles.secondaryAction}>
            Open draft
          </Link>
        ) : null}
      </div>
    </article>
  )
}
