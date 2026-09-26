'use client'

import { useRef } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const ARROW_KEY_STEP = 4

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

// A focal point (not a crop): the image always fills the box at its real
// aspect ratio via object-fit: cover, and dragging just moves which part of
// it stays visible - the same interaction as a social profile-photo
// repositioner, backed by a plain CSS object-position percentage.
export function ImageFocalPointField({
  src,
  x,
  y,
  aspectRatio,
  onChange,
}: {
  src: string
  x: number
  y: number
  aspectRatio: number
  onChange: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    // preventDefault above also suppresses the browser's default
    // focus-on-click, which would otherwise silently break arrow-key
    // nudging right after a click/drag.
    event.currentTarget.focus()
    const startX = event.clientX
    const startY = event.clientY
    const originX = x
    const originY = y

    function handlePointerMove(moveEvent: PointerEvent) {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const dxPercent = ((moveEvent.clientX - startX) / rect.width) * 100
      const dyPercent = ((moveEvent.clientY - startY) / rect.height) * 100
      // Dragging right/down reveals more of what's currently hidden on the
      // left/top, i.e. the focal point moves the opposite way - the same
      // direct-manipulation feel as sliding a photo under a fixed window.
      onChange(clampPercent(originX - dxPercent), clampPercent(originY - dyPercent))
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      onChange(clampPercent(x - ARROW_KEY_STEP), y)
      event.preventDefault()
    } else if (event.key === 'ArrowRight') {
      onChange(clampPercent(x + ARROW_KEY_STEP), y)
      event.preventDefault()
    } else if (event.key === 'ArrowUp') {
      onChange(x, clampPercent(y - ARROW_KEY_STEP))
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      onChange(x, clampPercent(y + ARROW_KEY_STEP))
      event.preventDefault()
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Reposition image within the card"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(x)}
        aria-valuetext={`${Math.round(x)}% across, ${Math.round(y)}% down`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: String(aspectRatio),
          overflow: 'hidden',
          borderRadius: 10,
          border: '1px solid color-mix(in srgb, var(--og-brass-700) 56%, var(--og-border-subtle))',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${x}% ${y}%`,
            pointerEvents: 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          Drag or use arrow keys to reposition
        </span>
      </div>
      {x !== 50 || y !== 50 ? (
        <button
          type="button"
          onClick={() => onChange(50, 50)}
          style={{
            justifySelf: 'start',
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--og-brass-700) 56%, var(--og-border-subtle))',
            background: 'transparent',
            color: 'var(--og-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Center image
        </button>
      ) : null}
    </div>
  )
}
