'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FeatureGuideEntry } from './feature-guide-types'
import styles from './feature-guide-tour.module.css'

type TourRect = {
  left: number
  top: number
  width: number
  height: number
}

type TourPosition = {
  ring: TourRect
  popup: TourRect
}

export default function FeatureGuideTour({
  activeIndex,
  guide,
  onClose,
  onNext,
  onPrevious,
  totalGuides,
}: {
  activeIndex: number
  guide: FeatureGuideEntry
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  totalGuides: number
}) {
  const [position, setPosition] = useState<TourPosition | null>(null)
  const isFirstGuide = activeIndex === 0
  const isLastGuide = activeIndex === totalGuides - 1

  const updatePosition = useCallback(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-feature-guide-target="${guide.uid}"]`
    )

    if (!target) {
      setPosition(null)
      return
    }

    const rect = target.getBoundingClientRect()
    const viewportMargin = 12
    const gap = 12
    const popupWidth = Math.min(340, window.innerWidth - viewportMargin * 2)
    const popupHeight = Math.min(320, window.innerHeight - viewportMargin * 2)
    const ringPadding = 7
    let left = rect.right + gap
    let top = rect.top + rect.height / 2 - popupHeight / 2

    if (guide.popup_placement.includes('left')) {
      left = rect.left - popupWidth - gap
    } else if (guide.popup_placement.includes('top')) {
      left = rect.left + rect.width / 2 - popupWidth / 2
      top = rect.top - popupHeight - gap
    } else if (guide.popup_placement.includes('bottom')) {
      left = guide.popup_placement.includes('end')
        ? rect.right - popupWidth
        : rect.left + rect.width / 2 - popupWidth / 2
      top = rect.bottom + gap
    }

    left = Math.max(
      viewportMargin,
      Math.min(left, window.innerWidth - popupWidth - viewportMargin)
    )
    top = Math.max(
      viewportMargin,
      Math.min(top, window.innerHeight - popupHeight - viewportMargin)
    )

    setPosition({
      ring: {
        left: Math.max(viewportMargin, rect.left - ringPadding),
        top: Math.max(viewportMargin, rect.top - ringPadding),
        width: rect.width + ringPadding * 2,
        height: rect.height + ringPadding * 2,
      },
      popup: {
        left,
        top,
        width: popupWidth,
        height: popupHeight,
      },
    })
  }, [guide])

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-feature-guide-target="${guide.uid}"]`
    )

    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })

    const frame = window.requestAnimationFrame(updatePosition)
    const timer = window.setTimeout(updatePosition, 260)

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [guide, updatePosition])

  const portalRoot = typeof document === 'undefined' ? null : document.body

  if (!portalRoot) {
    return null
  }

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.scrim} onClick={onClose} />

      {position ? (
        <div
          aria-hidden="true"
          className={styles.ring}
          style={{
            left: position.ring.left,
            top: position.ring.top,
            width: position.ring.width,
            height: position.ring.height,
          }}
        />
      ) : null}

      <aside
        role="dialog"
        aria-live="polite"
        aria-label={`${guide.feature_name} feature guide`}
        data-feature-guide-dialog="true"
        data-feature-guide-glass="frosted-heavy"
        className={styles.panel}
        style={{
          left: position?.popup.left ?? 16,
          top: position?.popup.top ?? 88,
          width: position?.popup.width ?? 'calc(100vw - 32px)',
          maxHeight: position?.popup.height ?? 'calc(100vh - 24px)',
        }}
      >
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Feature Guide</p>
            <h2 className={styles.title}>{guide.feature_name}</h2>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.counter}>
              {activeIndex + 1}/{totalGuides}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feature guide"
              className={styles.closeButton}
            >
              x
            </button>
          </div>
        </div>

        <div className={styles.panelBody}>
          <p className={styles.copy}>{guide.explanation}</p>
        </div>

        <div className={styles.panelFooter}>
          <button
            type="button"
            onClick={onPrevious}
            disabled={isFirstGuide}
            aria-label="Previous feature guide"
            className={styles.navButton}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isLastGuide}
            aria-label="Next feature guide"
            className={`${styles.navButton} ${styles.primaryButton}`}
          >
            Next
          </button>
        </div>
      </aside>
    </div>,
    portalRoot
  )
}
