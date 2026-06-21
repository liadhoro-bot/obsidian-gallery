'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const ZoomImage = dynamic(() => import('./zoomable-gallery-image'))

type GalleryImage = {
  id: string
  image_url: string
  alt_text?: string | null
  is_featured?: boolean | null
}

type GalleryImageCardProps = {
  image: GalleryImage
  canEdit?: boolean
  onToggleFeatured?: (imageId: string) => Promise<void>
}

export default function GalleryImageCard({
  image,
  canEdit = false,
  onToggleFeatured,
}: GalleryImageCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleToggleFeatured(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()

    if (!onToggleFeatured || isPending) return

    startTransition(async () => {
      await onToggleFeatured(image.id)
    })
  }

  return (
    <>
      <div
  role="button"
  tabIndex={0}
  onClick={() => setIsOpen(true)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
    }
  }}
  className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/5"
>
        <Image
          src={image.image_url}
          alt={image.alt_text || 'Gallery image'}
          fill
          sizes="(max-width: 768px) 33vw, 180px"
          className="object-cover transition duration-300 group-hover:scale-105"
        />

        {canEdit && (
          <button
            type="button"
            onClick={handleToggleFeatured}
            disabled={isPending}
            className={[
              'absolute left-2 top-2 z-10 rounded-full px-3 py-1 text-[11px] font-bold shadow-lg backdrop-blur transition',
              image.is_featured
                ? 'bg-cyan-300 text-slate-950'
                : 'bg-black/35 text-cyan-100 ring-1 ring-cyan-300/30 hover:bg-cyan-300 hover:text-slate-950',
              isPending ? 'opacity-60' : '',
            ].join(' ')}
          >
            {image.is_featured ? 'Featured' : 'Make featured'}
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
          onClick={() => setIsOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 z-50 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur"
          >
            Close
          </button>

          <div
            className="h-full max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ZoomImage
              src={image.image_url}
              alt={image.alt_text || 'Gallery image'}
            />
          </div>
        </div>
      )}
    </>
  )
}
