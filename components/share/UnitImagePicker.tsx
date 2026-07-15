'use client'

import type { UnitCompletedShareImage } from '@/lib/share/unitCompleted'

type Props = {
  images: UnitCompletedShareImage[]
  selectedImageId: string
  onSelectImage: (image: UnitCompletedShareImage) => void
}

export default function UnitImagePicker({
  images,
  selectedImageId,
  onSelectImage,
}: Props) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
        Change image
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll">
        {images.map((image) => {
          const isSelected = image.id === selectedImageId
          const hasImage = image.source !== 'placeholder' && Boolean(image.url)

          return (
            <button
              key={image.id}
              type="button"
              onClick={() => onSelectImage(image)}
              className={`tap-press flex w-24 shrink-0 flex-col overflow-hidden rounded-xl border bg-black text-left ${
                isSelected
                  ? 'border-[#d5ad67] shadow-[0_0_0_2px_rgba(213,173,103,0.22)]'
                  : 'border-white/10'
              }`}
              aria-label={`Use ${image.label}`}
            >
              <span className="flex h-20 w-full items-center justify-center overflow-hidden bg-[#050505]">
                {hasImage ? (
                  <img
                    src={image.url}
                    alt={image.alt}
                    className="h-full w-full object-contain"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-white/55">
                    Placeholder
                  </span>
                )}
              </span>
              <span className="min-h-7 border-t border-white/10 bg-black/80 px-1.5 py-1 text-center text-[9px] font-bold uppercase leading-tight tracking-[0.06em] text-white/80">
                {image.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
