'use client'

import { useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import styles from './gallery-pager.module.css'

// Galleries show one row of three images at a time and page through the
// rest, so a page with a big gallery only ever loads three photos up front.
export const GALLERY_PAGE_SIZE = 3

export function useGalleryPages<T>(items: T[], pageSize = GALLERY_PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  // Clamp instead of syncing state, so deletes never strand an empty page.
  const page = Math.min(requestedPage, pageCount - 1)
  const start = page * pageSize
  const touchStartX = useRef<number | null>(null)

  function goToPage(nextPage: number) {
    setRequestedPage(Math.max(0, Math.min(nextPage, pageCount - 1)))
  }

  return {
    page,
    pageCount,
    pageSize,
    pageItems: items.slice(start, start + pageSize),
    // Index of the first item on this page within the full list.
    pageStart: start,
    isLastPage: page === pageCount - 1,
    goToPage,
    // For items not yet counted in pageCount (e.g. just-uploaded photos).
    showItemAt: (index: number) => setRequestedPage(Math.max(0, Math.floor(index / pageSize))),
    // Swipe left/right on the grid to page, carousel-style.
    swipeHandlers: {
      onTouchStart: (event: TouchEvent) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      },
      onTouchEnd: (event: TouchEvent) => {
        const startX = touchStartX.current
        touchStartX.current = null
        const endX = event.changedTouches[0]?.clientX
        if (startX === null || endX === undefined) return
        const deltaX = endX - startX
        if (Math.abs(deltaX) < 48) return
        goToPage(deltaX < 0 ? page + 1 : page - 1)
      },
    },
  }
}

export default function GalleryPager({
  page,
  pageCount,
  onPageChange,
  label = 'Gallery pages',
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  label?: string
}) {
  if (pageCount <= 1) return null

  return (
    <nav className={styles.pager} aria-label={label}>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.pagerButton}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous photos"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {pageCount <= 7 ? (
          <div className={styles.dots}>
            {Array.from({ length: pageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                className={styles.dot}
                aria-current={index === page ? 'page' : undefined}
                aria-label={`Photos page ${index + 1}`}
                onClick={() => onPageChange(index)}
              />
            ))}
          </div>
        ) : (
          <span className={styles.count}>
            {page + 1} / {pageCount}
          </span>
        )}
        <button
          type="button"
          className={styles.pagerButton}
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount - 1}
          aria-label="Next photos"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.icon}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
