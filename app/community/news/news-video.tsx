'use client'

import { useState } from 'react'
import { youTubeThumbnailUrl } from './news-data'
import styles from './news.module.css'

// The official video, through YouTube's own embedded player. Until it's
// tapped we only show YouTube's thumbnail, so the page doesn't load the
// player (or YouTube cookies) for readers who don't watch.
export function NewsVideo({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        className={styles.videoFrame}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    )
  }

  return (
    <button
      type="button"
      className={styles.videoFacade}
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={youTubeThumbnailUrl(videoId)} alt="" referrerPolicy="no-referrer" />
      <span className={styles.playBadge} aria-hidden="true" />
    </button>
  )
}
