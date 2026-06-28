'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { buildVaultColorMatchHref } from '@/components/color-sampler/color-match-navigation'

const ColorSamplerDialog = dynamic(
  () => import('@/components/color-sampler/ColorSamplerDialog'),
  { ssr: false }
)

type Props = {
  themeId: string
  heroUrl: string | null
  themeName: string
  deleteThemeImageAction: (formData: FormData) => Promise<void>
}

export default function ThemeImageGallery({
  themeId,
  heroUrl,
  themeName,
  deleteThemeImageAction,
}: Props) {
  const router = useRouter()
  const [localHeroUrl, setLocalHeroUrl] = useState(heroUrl)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [isEditingImages, setIsEditingImages] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null)
  const [samplerImageUrl, setSamplerImageUrl] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!localHeroUrl) {
    return null
  }

  function handleDeleteSelectedImages() {
    if (selectedImageIds.length === 0) return

    const previousHeroUrl = localHeroUrl
    const imageIdsToDelete = selectedImageIds
    const formData = new FormData()

    formData.set('themeId', themeId)
    imageIdsToDelete.forEach((imageId) =>
      formData.append('imageIds', imageId)
    )

    setActionError(null)
    setIsConfirmingDelete(false)
    setSelectedImageIds([])
    setLocalHeroUrl(null)

    startTransition(async () => {
      try {
        await deleteThemeImageAction(formData)
        router.refresh()
      } catch (error) {
        setLocalHeroUrl(previousHeroUrl)
        setSelectedImageIds(imageIdsToDelete)
        setActionError(
          error instanceof Error ? error.message : 'Could not delete image.'
        )
      }
    })
  }

  return (
    <section className="px-4 pt-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/45">
              Gallery
            </h2>
            {isEditingImages ? (
              <p className="mt-1 text-sm text-white/55">
                {selectedImageIds.length > 0
                  ? `${selectedImageIds.length} selected`
                  : 'Select images to erase'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditingImages((current) => !current)
                setSelectedImageIds([])
                setIsConfirmingDelete(false)
              }}
              className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
            >
              {isEditingImages ? 'Done' : 'Edit'}
            </button>

            {isEditingImages && selectedImageIds.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedImageIds([])
                  setIsConfirmingDelete(false)
                }}
                className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
              >
              Clear
            </button>
            ) : null}

            {isEditingImages ? (
              <button
                type="button"
                onClick={() =>
                  selectedImageIds.length === 0
                    ? setSelectedImageIds(['hero'])
                    : isConfirmingDelete
                      ? handleDeleteSelectedImages()
                      : setIsConfirmingDelete(true)
                }
                disabled={isPending}
                className="tap-press rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {isPending
                  ? 'Deleting...'
                  : selectedImageIds.length === 0
                    ? 'Select'
                    : isConfirmingDelete
                      ? 'Erase 1'
                      : 'Delete Selected'}
              </button>
            ) : null}
          </div>
        </div>

        {actionError ? (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {actionError}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            {isEditingImages ? (
              <label className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 ring-1 ring-white/20">
                <input
                  type="checkbox"
                  checked={selectedImageIds.includes('hero')}
                  onChange={() => {
                    setIsConfirmingDelete(false)
                    setSelectedImageIds((current) =>
                      current.includes('hero') ? [] : ['hero']
                    )
                  }}
                  className="h-4 w-4 accent-red-500"
                  aria-label="Select theme image for deletion"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (!isEditingImages) setExpandedImageUrl(localHeroUrl)
              }}
              className="tap-card block w-full"
              aria-label="Expand theme image"
            >
              <Image
                src={localHeroUrl}
                alt={themeName || 'Theme image'}
                width={180}
                height={120}
                sizes="(max-width: 768px) 33vw, 160px"
                className="h-28 w-full object-cover"
              />
            </button>
          </div>
        </div>
      </div>

      {expandedImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setExpandedImageUrl(null)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${themeName || 'Theme'} image`}
        >
          <div
            className="absolute left-4 top-4 z-50"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSamplerImageUrl(expandedImageUrl)}
              className="tap-press inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-black/70 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 backdrop-blur transition hover:bg-cyan-300/15"
              aria-label="Match Paint from theme image"
            >
              <span aria-hidden="true">◎</span>
              Match Paint
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpandedImageUrl(null)}
            className="tap-press mobile-close-button absolute right-4 top-4 z-50 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur"
          >
            Close
          </button>

          <div
            className="mobile-scroll max-h-[88dvh] max-w-6xl overflow-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={expandedImageUrl}
              alt={themeName || 'Theme image'}
              width={1400}
              height={1400}
              sizes="100vw"
              className="max-h-[88dvh] rounded-2xl object-contain"
            />
          </div>
        </div>
      ) : null}

      {samplerImageUrl ? (
        <ColorSamplerDialog
          open={Boolean(samplerImageUrl)}
          onOpenChange={(open) => {
            if (!open) setSamplerImageUrl(null)
          }}
          imageSource={{ src: samplerImageUrl, alt: themeName || 'Theme image' }}
          source="theme_gallery"
          allowCameraCapture={false}
          allowImageUpload={false}
          onConfirm={(sample) => {
            setSamplerImageUrl(null)
            setExpandedImageUrl(null)
            startTransition(() => {
              router.push(buildVaultColorMatchHref(sample))
            })
          }}
        />
      ) : null}
    </section>
  )
}
