'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import UnitCompletedCardPreview from './UnitCompletedCardPreview'
import {
  getRandomCuratorQuote,
  type UnitCompletedShareImage,
} from '@/lib/share/unitCompleted'

type UnitImage = {
  id: string
  image_url: string
  is_featured: boolean
  created_at: string
  sort_order: number | null
  alt_text: string | null
}

type Session = {
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

type Props = {
  unitName: string
  completedAt: string | null
  images: UnitImage[]
  sessions: Session[]
  onShareClick: () => void
}

const SHARE_CARD_WIDTH = 540
const SHARE_CARD_HEIGHT = 960
const THUMBNAIL_WIDTH = 132

export default function UnitCompletedInlinePreview({
  unitName,
  completedAt,
  images,
  sessions,
  onShareClick,
}: Props) {
  const expandedPreviewRef = useRef<HTMLDivElement | null>(null)
  const [quote] = useState(() => getRandomCuratorQuote())
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [expandedPreviewBounds, setExpandedPreviewBounds] = useState({
    width: 0,
    height: 0,
  })
  const shareImage = useMemo(
    () => getBestShareImage(unitName, images),
    [images, unitName]
  )
  const totalSeconds = useMemo(
    () => sessions.reduce((sum, session) => sum + getSessionSeconds(session), 0),
    [sessions]
  )
  const completedSessions = useMemo(
    () => sessions.filter((session) => Boolean(session.ended_at)),
    [sessions]
  )
  const expandedPreviewScale =
    expandedPreviewBounds.width > 0 && expandedPreviewBounds.height > 0
      ? Math.min(
          expandedPreviewBounds.width / SHARE_CARD_WIDTH,
          expandedPreviewBounds.height / SHARE_CARD_HEIGHT
        )
      : 0

  useEffect(() => {
    if (!isPreviewExpanded || !expandedPreviewRef.current) {
      return
    }

    const previewElement = expandedPreviewRef.current
    const updatePreviewBounds = () => {
      const rect = previewElement.getBoundingClientRect()
      setExpandedPreviewBounds({
        width: rect.width,
        height: rect.height,
      })
    }
    const observer = new ResizeObserver(updatePreviewBounds)

    updatePreviewBounds()
    observer.observe(previewElement)

    return () => observer.disconnect()
  }, [isPreviewExpanded])

  return (
    <section className="mx-auto mt-8 max-w-[470px] rounded-[24px] border border-[#d8a84f]/35 bg-[radial-gradient(circle_at_16%_0%,rgba(216,168,79,0.16),transparent_34%),linear-gradient(180deg,#071018,#03080d)] p-4 shadow-[0_0_28px_rgba(0,0,0,0.28)]">
      <div className="grid gap-4 min-[420px]:grid-cols-[132px_1fr] min-[420px]:items-center">
        <button
          type="button"
          onClick={() => setIsPreviewExpanded(true)}
          className="group mx-auto w-[132px] overflow-hidden rounded-xl border border-[#d8a84f]/45 bg-black shadow-[0_0_22px_rgba(216,168,79,0.12)] focus:outline-none focus:ring-2 focus:ring-[#d8a84f]/70"
          aria-label="Expand completed unit card preview"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden">
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: SHARE_CARD_WIDTH,
                height: SHARE_CARD_HEIGHT,
                transform: `scale(${THUMBNAIL_WIDTH / SHARE_CARD_WIDTH})`,
              }}
            >
              <UnitCompletedCardPreview
                unitName={unitName}
                image={shareImage}
                totalSeconds={totalSeconds}
                completedAt={completedAt || new Date().toISOString()}
                sessionCount={completedSessions.length}
                quote={quote}
              />
            </div>
            <span className="absolute bottom-2 right-2 rounded-full border border-white/15 bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/80 opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100">
              Expand
            </span>
          </div>
        </button>

        <div className="min-w-0 text-center min-[420px]:text-left">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d8a84f]">
            Unit Completed
          </div>
          <h2 className="mt-2 text-2xl font-black leading-tight text-white">
            Achievement unlocked
          </h2>
          <p className="mt-2 text-sm leading-5 text-white/55">
            Your finished unit card is ready for the gallery.
          </p>

          <button
            type="button"
            onClick={onShareClick}
            className="tap-press mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#22e5ff] px-4 text-sm font-black text-[#020d19] shadow-[0_0_20px_rgba(34,229,255,0.22)] transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-[#22e5ff]/70"
          >
            Share this Achievement!
          </button>
        </div>
      </div>

      {isPreviewExpanded ? (
        <div
          className="fixed inset-0 z-[70] bg-black/92 p-3 backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded completed unit card preview"
          onClick={() => setIsPreviewExpanded(false)}
        >
          <button
            type="button"
            onClick={() => setIsPreviewExpanded(false)}
            className="tap-press absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-xl font-bold text-white/80"
            aria-label="Close expanded preview"
          >
            x
          </button>
          <div
            ref={expandedPreviewRef}
            className="flex h-full w-full items-center justify-center"
          >
            {expandedPreviewScale > 0 ? (
              <div
                className="relative overflow-hidden rounded-xl border border-[#d8a84f]/35 bg-black shadow-[0_28px_90px_rgba(0,0,0,0.85)]"
                style={{
                  width: SHARE_CARD_WIDTH * expandedPreviewScale,
                  height: SHARE_CARD_HEIGHT * expandedPreviewScale,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{
                    width: SHARE_CARD_WIDTH,
                    height: SHARE_CARD_HEIGHT,
                    transform: `scale(${expandedPreviewScale})`,
                  }}
                >
                  <UnitCompletedCardPreview
                    unitName={unitName}
                    image={shareImage}
                    totalSeconds={totalSeconds}
                    completedAt={completedAt || new Date().toISOString()}
                    sessionCount={completedSessions.length}
                    quote={quote}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function getBestShareImage(
  unitName: string,
  images: UnitImage[]
): UnitCompletedShareImage {
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_featured !== b.is_featured) {
      return a.is_featured ? -1 : 1
    }

    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
  const image =
    sortedImages.find((candidate) => candidate.is_featured) ||
    sortedImages.find((candidate) => !candidate.alt_text?.startsWith('stage:')) ||
    sortedImages.find((candidate) => candidate.alt_text?.startsWith('stage:'))

  if (!image?.image_url) {
    return {
      id: 'placeholder-inline',
      url: '',
      label: 'Placeholder',
      alt: unitName,
      source: 'placeholder',
    }
  }

  return {
    id: `inline-${image.id}`,
    url: image.image_url,
    label: image.is_featured ? 'Featured' : 'Gallery',
    alt: image.alt_text || unitName,
    source: image.alt_text?.startsWith('stage:')
      ? 'stage'
      : image.is_featured
        ? 'featured'
        : 'gallery',
  }
}

function getSessionSeconds(session: Session) {
  if (typeof session.duration_seconds === 'number') {
    return Math.max(0, session.duration_seconds)
  }

  if (!session.ended_at) {
    return 0
  }

  const startedAt = new Date(session.started_at).getTime()
  const endedAt = new Date(session.ended_at).getTime()

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return 0
  }

  return Math.max(0, Math.floor((endedAt - startedAt) / 1000))
}
