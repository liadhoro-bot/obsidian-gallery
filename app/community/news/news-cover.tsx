import Image from 'next/image'
import { detectGameSystem } from '@/lib/news/game-systems'
import { newsCategoryLabels, type NewsCategory } from './news-data'
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

// Our own cover art for stories with no image or video cleared for use:
// the game or range, its maker, and a colour per game, all drawn in CSS.
export function NewsCover({
  headline,
  category,
  manufacturer,
  context,
  size = 'large',
}: {
  headline: string
  category: NewsCategory
  manufacturer?: string | null
  // Extra text to read the game from, such as the summary.
  context?: string | null
  size?: 'thumb' | 'large'
}) {
  const official = category === 'og_announcement'
  const system = official ? null : detectGameSystem(headline, context, manufacturer)
  const label = official ? 'Obsidian Gallery' : system?.label ?? newsCategoryLabels[category]
  const maker = official ? 'Announcement' : manufacturer || system?.maker || 'Hobby news'
  const monogram = system?.monogram

  return (
    <span
      className={styles.cover}
      data-size={size}
      data-tone={official ? 'official' : system?.tone ?? 'neutral'}
      aria-hidden="true"
    >
      <span className={styles.coverPlate} data-chars={monogram ? Math.min(monogram.length, 3) : undefined}>
        {official ? (
          <Image src="/icon-192.png" alt="" width={size === 'large' ? 44 : 28} height={size === 'large' ? 44 : 28} />
        ) : monogram ? (
          <span className={styles.coverMonogram}>{monogram}</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {categoryIconPaths[category as Exclude<NewsCategory, 'og_announcement'>]}
          </svg>
        )}
      </span>
      {size === 'large' ? (
        <span className={styles.coverText}>
          <span className={styles.coverLabel}>{label}</span>
          {maker !== label ? <span className={styles.coverMaker}>{maker}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
