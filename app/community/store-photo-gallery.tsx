'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function StorePhotoGallery({
  photos,
  slots,
  storeName,
}: {
  photos: string[]
  slots: number
  storeName: string
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const touchStartX = useRef<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (direction: -1 | 1) =>
      setOpenIndex((current) =>
        current === null ? null : (current + direction + photos.length) % photos.length
      ),
    [photos.length]
  )

  useEffect(() => {
    if (openIndex === null) return
    closeButton.current?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [openIndex, close, step])

  return (
    <>
      <ul data-v3-community-indicator="store-photos">
        {Array.from({ length: slots }, (_, index) => {
          const photo = photos[index]
          return (
            <li
              key={photo ?? `placeholder-${index}`}
              data-placeholder={photo ? undefined : 'true'}
            >
              {photo ? (
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  aria-label={`Open ${storeName} photo ${index + 1}`}
                  data-v3-community-indicator="store-photo-button"
                >
                  <Image
                    src={photo}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 33vw, 150px"
                    className="object-cover"
                  />
                </button>
              ) : (
                <span>Photo coming soon</span>
              )}
            </li>
          )
        })}
      </ul>

      {openIndex !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${storeName} photo ${openIndex + 1} of ${photos.length}`}
          data-v3-community-indicator="photo-viewer"
          onClick={close}
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current
            const end = event.changedTouches[0]?.clientX
            touchStartX.current = null
            if (start === null || end === undefined || photos.length < 2) return
            if (Math.abs(end - start) > 50) step(end < start ? 1 : -1)
          }}
        >
          <div data-v3-community-indicator="photo-viewer-frame">
            <Image
              src={photos[openIndex]}
              alt={`${storeName} photo ${openIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>

          <button
            ref={closeButton}
            type="button"
            aria-label="Close photo"
            data-v3-community-indicator="photo-viewer-close"
            onClick={close}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                data-v3-community-indicator="photo-viewer-prev"
                onClick={(event) => {
                  event.stopPropagation()
                  step(-1)
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next photo"
                data-v3-community-indicator="photo-viewer-next"
                onClick={(event) => {
                  event.stopPropagation()
                  step(1)
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <p data-v3-community-indicator="photo-viewer-count">
                {openIndex + 1} / {photos.length}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
