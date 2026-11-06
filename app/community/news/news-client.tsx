'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { capturePostHog } from '../../../utils/analytics/client'
import styles from './news.module.css'

export function NewsFeedTracker({
  surface,
  category,
  page,
}: {
  surface: 'community_tab' | 'archive'
  category?: string | null
  page?: number
}) {
  useEffect(() => {
    void capturePostHog('news_feed_viewed', {
      surface,
      category: category ?? 'all',
      page: page ?? 1,
    })
  }, [surface, category, page])

  return null
}

export function NewsArticleTracker({
  slug,
  category,
  manufacturer,
}: {
  slug: string
  category: string
  manufacturer: string | null
}) {
  useEffect(() => {
    void capturePostHog('news_article_opened', { slug, category, manufacturer })
  }, [slug, category, manufacturer])

  return null
}

// A plain outbound link: no confirmation step and no parameters added.
export function NewsSourceLink({
  slug,
  sourceName,
  ...props
}: ComponentProps<'a'> & { slug: string; sourceName: string | null }) {
  function track() {
    void capturePostHog('news_original_source_clicked', { slug, source: sourceName })
  }

  return (
    <a
      {...props}
      target="_blank"
      rel="noopener"
      onClick={track}
      onAuxClick={(event) => {
        if (event.button === 1) track()
      }}
    />
  )
}

export function NewsShareButton({ slug, headline }: { slug: string; headline: string }) {
  const [notice, setNotice] = useState<string | null>(null)

  async function share() {
    const url = window.location.href.split(/[?#]/)[0]

    if (navigator.share) {
      try {
        await navigator.share({ title: headline, url })
        void capturePostHog('news_article_shared', { slug, method: 'native' })
      } catch {
        // Closing the share sheet isn't a failure, and there's nothing to retry.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setNotice('Link copied')
      void capturePostHog('news_article_shared', { slug, method: 'copy_link' })
    } catch {
      setNotice('Copy the link from the address bar')
    }
    window.setTimeout(() => setNotice(null), 2500)
  }

  return (
    <button type="button" className={styles.secondaryAction} onClick={share}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15V4M8 8l4-4 4 4" />
        <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      </svg>
      <span role="status">{notice ?? 'Share'}</span>
    </button>
  )
}
