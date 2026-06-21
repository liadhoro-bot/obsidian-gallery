'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

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

            <Image
              src={localHeroUrl}
              alt={themeName || 'Theme image'}
              width={180}
              height={120}
              sizes="(max-width: 768px) 33vw, 160px"
              className="h-28 w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
