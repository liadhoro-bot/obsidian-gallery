'use client'

import Image from 'next/image'
import { useState } from 'react'
import styles from './contest-v3-silver.module.css'

type GalleryImage = {
  id: string
  image_url: string
  alt_text: string | null
}

export default function ContestNomineeGalleryLightbox({
  images,
  title,
}: {
  images: GalleryImage[]
  title: string
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeImage = activeIndex !== null ? images[activeIndex] : null

  function showPrevious() {
    setActiveIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length
    )
  }

  function showNext() {
    setActiveIndex((current) => (current === null ? null : (current + 1) % images.length))
  }

  return (
    <>
      <div className={`${styles.tileGrid} mt-3`}>
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className={styles.galleryTileButton}
            onClick={() => setActiveIndex(index)}
            aria-label={`View larger image ${index + 1} of ${images.length}`}
          >
            <div className={styles.nomineeTileImage}>
              <Image
                src={image.image_url}
                alt={image.alt_text || ''}
                fill
                sizes="(max-width: 640px) 33vw, 220px"
                className="object-cover"
              />
            </div>
          </button>
        ))}
      </div>

      {activeImage ? (
        <div
          className={styles.lightboxOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveIndex(null)
          }}
        >
          <div className={styles.lightboxImageWrap}>
            <Image
              src={activeImage.image_url}
              alt={activeImage.alt_text || title}
              fill
              sizes="640px"
              className="object-contain"
            />
            <button
              type="button"
              className={styles.lightboxCloseButton}
              onClick={() => setActiveIndex(null)}
              aria-label="Close"
            >
              ×
            </button>
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className={`${styles.lightboxNavButton} ${styles.lightboxNavPrev}`}
                  onClick={showPrevious}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxNavButton} ${styles.lightboxNavNext}`}
                  onClick={showNext}
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
