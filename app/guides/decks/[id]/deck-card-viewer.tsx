'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode, WheelEvent } from 'react'
import FeatureGuideLauncher from '../../../components/feature-guide-launcher'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import styles from './deck-card-viewer.module.css'

export type DeckCardEntry = {
  key: string
  node: ReactNode
  featureGuideTarget?: string
}

type DeckCardViewerProps = {
  cards: DeckCardEntry[]
  title: string
  backHref: string
  featureGuides: FeatureGuideEntry[]
}

export default function DeckCardViewer({
  cards,
  title,
  backHref,
  featureGuides,
}: DeckCardViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeLastX = useRef<number | null>(null)
  const wheelLocked = useRef(false)
  const totalCards = cards.length

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0))
  }, [])

  const goNext = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, totalCards - 1))
  }, [totalCards])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious])

  function handleSwipeStart(clientX: number, clientY: number) {
    swipeStartX.current = clientX
    swipeStartY.current = clientY
    swipeLastX.current = clientX
  }

  function handleSwipeMove(clientX: number) {
    swipeLastX.current = clientX
  }

  function handleSwipeEnd(clientX?: number, clientY?: number) {
    if (swipeStartX.current === null) return

    const endX = clientX ?? swipeLastX.current ?? swipeStartX.current
    const endY = clientY ?? swipeStartY.current ?? 0
    const diffX = swipeStartX.current - endX
    const diffY = (swipeStartY.current ?? 0) - endY

    if (Math.abs(diffX) > 44 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      if (diffX > 0) {
        goNext()
      } else {
        goPrevious()
      }
    }

    swipeStartX.current = null
    swipeStartY.current = null
    swipeLastX.current = null
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (wheelLocked.current) return

    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    if (!horizontalIntent || Math.abs(event.deltaX) < 24) return

    event.preventDefault()
    wheelLocked.current = true

    if (event.deltaX > 0) {
      goNext()
    } else {
      goPrevious()
    }

    window.setTimeout(() => {
      wheelLocked.current = false
    }, 450)
  }

  return (
    <div className={styles.viewer} role="group" aria-label={`${title} cards`}>
      <Link
        href={backHref}
        className={styles.backButton}
        aria-label="Back to guides"
        data-feature-guide-target="guides.deck.page"
      >
        <span>&lt;</span>
      </Link>

      <FeatureGuideLauncher
        buttonClassName={styles.helpButton}
        guides={featureGuides}
        label="Show deck detail explanation"
      />

      <div
        className={styles.track}
        onWheel={handleWheel}
        onTouchStart={(event) =>
          handleSwipeStart(
            event.touches[0]?.clientX ?? 0,
            event.touches[0]?.clientY ?? 0
          )
        }
        onTouchMove={(event) =>
          handleSwipeMove(event.touches[0]?.clientX ?? 0)
        }
        onTouchEnd={(event) =>
          handleSwipeEnd(
            event.changedTouches[0]?.clientX ?? 0,
            event.changedTouches[0]?.clientY ?? 0
          )
        }
        onPointerDown={(event) => {
          if (event.pointerType !== 'touch') {
            event.currentTarget.setPointerCapture(event.pointerId)
            handleSwipeStart(event.clientX, event.clientY)
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') handleSwipeMove(event.clientX)
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== 'touch') {
            handleSwipeEnd(event.clientX, event.clientY)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        }}
        onPointerCancel={(event) => {
          if (event.pointerType !== 'touch') handleSwipeEnd()
        }}
      >
        <div
          className={styles.trackInner}
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {cards.map((card) => (
            <div
              key={card.key}
              className={styles.slide}
              data-feature-guide-target={card.featureGuideTarget}
            >
              {card.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
