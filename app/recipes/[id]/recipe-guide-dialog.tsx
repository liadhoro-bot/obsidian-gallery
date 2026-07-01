'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import type {
  Recipe,
  RecipeImage,
  RecipeStep,
  StepPaintLink,
} from './components/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
} from './components/recipe-guide-cards'

type Props = {
  isOpen: boolean
  onClose: () => void
  recipe: Recipe
  steps: RecipeStep[]
  featuredImage: RecipeImage | null
  paintsByStepId: Map<string, StepPaintLink[]>
  stepPaintLinks: StepPaintLink[]
}

function hasImage(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return url.startsWith('http://') || url.startsWith('https://')
}

export default function RecipeGuideDialog({
  isOpen,
  onClose,
  recipe,
  steps,
  featuredImage,
  paintsByStepId,
  stepPaintLinks,
}: Props) {
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const swipeLastX = useRef<number | null>(null)
  const wheelLocked = useRef(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const totalCards = steps.length + 1

  const goPrevious = useCallback(() => {
    setActiveCardIndex((current) => Math.max(current - 1, 0))
  }, [])

  const goNext = useCallback(() => {
    setActiveCardIndex((current) => Math.min(current + 1, totalCards - 1))
  }, [totalCards])

  const paintCount = useMemo(() => {
    const ids = new Set<string>()

    for (const link of stepPaintLinks) {
      if (link.paint?.id) ids.add(link.paint.id)
    }

    return ids.size
  }, [stepPaintLinks])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const resetId = window.setTimeout(() => setActiveCardIndex(0), 0)
    return () => window.clearTimeout(resetId)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrevious, isOpen, onClose])

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

  if (!isOpen) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${recipe.name} recipe guide`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: 'rgba(0, 0, 0, 0.92)',
        padding: '16px 12px',
      }}
    >
      <div
        className="cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
        style={{
          aspectRatio: '2 / 3',
          width:
            'min(430px, calc(100vw - 24px), calc((100dvh - 32px) * 0.6667))',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100dvh - 32px)',
        }}
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
          className="flex h-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: `translateX(-${activeCardIndex * 100}%)`,
          }}
        >
          <div className="h-full min-w-full max-w-full shrink-0 px-1">
            <RecipeGuideCoverCard
              recipe={recipe}
              featuredImage={featuredImage}
              stepCount={steps.length}
              paintCount={paintCount}
            />
          </div>

          {steps.map((step) => {
            const paintsForStep = paintsByStepId.get(step.id) || []
            const paints = paintsForStep.flatMap((link) =>
              link.paint
                ? [
                    {
                      ...link.paint,
                      ratio_text: link.ratio_text,
                    },
                  ]
                : []
            )

            return (
              <div
                key={step.id}
                className="h-full min-w-full max-w-full shrink-0 px-1"
              >
                {hasImage(step.image_url) ? (
                  <RecipeGuideImageStepCard
                    step={step}
                    stepsLength={steps.length}
                    paints={paints}
                  />
                ) : (
                  <RecipeGuideDescriptiveStepCard
                    step={step}
                    stepsLength={steps.length}
                    paints={paints}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
