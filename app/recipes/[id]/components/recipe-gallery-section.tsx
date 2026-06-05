'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import SubmitButton from '../../../components/SubmitButton'
import { Recipe, RecipeImage } from './types'
import type { GalleryUploadResult } from '../../../../utils/images/gallery-upload'

export default function RecipeGallerySection({
  recipe,
  recipeImages,
  isOwner,
  isAddingImage,
  setIsAddingImage,
  deleteConfirmImageId,
  setDeleteConfirmImageId,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
}: {
  recipe: Recipe
  recipeImages: RecipeImage[]
  isOwner: boolean
  isAddingImage: boolean
  setIsAddingImage: (value: boolean) => void
  deleteConfirmImageId: string | null
  setDeleteConfirmImageId: (value: string | null) => void
  uploadRecipeImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [filePreviews, setFilePreviews] = useState<
    { file: File; previewUrl: string }[]
  >([])

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    setFilePreviews(previews)

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl))
    }
  }, [selectedFiles])

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    setSelectedFiles(Array.from(event.target.files ?? []))
  }

  function removePendingFile(indexToRemove: number) {
    setSelectedFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    )
  }

  async function handleUpload(formData: FormData) {
    if (selectedFiles.length === 0) {
      setUploadError('Choose at least one image to upload.')
      return
    }

    const uploadFormData = new FormData()
    uploadFormData.set('recipeId', recipe.id)
    uploadFormData.set('altText', formData.get('altText')?.toString() || '')
    selectedFiles.forEach((file) => uploadFormData.append('image', file))

    setUploadError(null)

    const result = await uploadRecipeImageAction(uploadFormData)

    if (result?.failed.length) {
      setUploadError(
        `Could not upload ${result.failed
          .map((failure) => `${failure.fileName}: ${failure.reason}`)
          .join('; ')}`
      )
    } else {
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Gallery</h2>

        {isOwner ? (
          <button
            type="button"
            onClick={() => setIsAddingImage(!isAddingImage)}
            className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
            title="Add image"
          >
            +
          </button>
        ) : null}
      </div>

      {isOwner && isAddingImage ? (
        <div className="mt-4 rounded-2xl border border-neutral-800 bg-black p-4">
          <form action={handleUpload} className="space-y-4">
            <input type="hidden" name="recipeId" value={recipe.id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Upload Image
              </label>
              <input
                name="image"
                type="file"
                accept="image/*"
                multiple
                required
                ref={fileInputRef}
                onChange={handleFileSelection}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-medium file:text-black"
              />
            </div>

            {filePreviews.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {filePreviews.map((preview, index) => (
                  <div
                    key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                  >
                    <Image
                      src={preview.previewUrl}
                      alt={preview.file.name}
                      width={120}
                      height={96}
                      unoptimized
                      className="h-20 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/75 px-2 py-0.5 text-xs font-bold text-white"
                      aria-label={`Remove ${preview.file.name}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {uploadError ? (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                {uploadError}
              </p>
            ) : null}

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Alt Text (optional)
              </label>
              <input
                name="altText"
                type="text"
                placeholder="e.g. Finished armor highlight reference"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />
            </div>

            <div className="flex gap-2">
              <SubmitButton
                idleText={
                  selectedFiles.length > 1
                    ? `Upload ${selectedFiles.length} images`
                    : 'Upload image'
                }
                pendingText={
                  selectedFiles.length > 1
                    ? 'Uploading images...'
                    : 'Uploading image...'
                }
                disabled={selectedFiles.length === 0}
                className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
              />

              <button
                type="button"
                onClick={() => setIsAddingImage(false)}
                className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {recipeImages.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {recipeImages.map((image) => (
            <div
              key={image.id}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-black"
            >
              <Image
                src={image.image_url}
                alt={image.alt_text || recipe.name}
                width={320}
                height={160}
                sizes="(max-width: 768px) 50vw, 200px"
                className="h-40 w-full object-cover"
              />

              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  {image.is_featured ? (
                    <span className="inline-block rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                      Featured
                    </span>
                  ) : isOwner ? (
                    <form action={setFeaturedRecipeImageAction}>
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                        title="Set as featured"
                      >
                        ★
                      </button>
                    </form>
                  ) : null}

                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirmImageId(
                          deleteConfirmImageId === image.id ? null : image.id
                        )
                      }
                      className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                      title="Delete image"
                    >
                      X
                    </button>
                  ) : null}
                </div>

                {isOwner && deleteConfirmImageId === image.id ? (
                  <div className="rounded-xl border border-neutral-700 bg-black p-3">
                    <p className="text-sm text-white">Delete this image?</p>

                    <div className="mt-3 flex gap-2">
                      <form action={deleteRecipeImageAction}>
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <input type="hidden" name="imageId" value={image.id} />
                        <SubmitButton
                          idleText="Delete"
                          pendingText="Deleting..."
                          className="rounded-xl border border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-black"
                        />
                      </form>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmImageId(null)}
                        className="rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {image.alt_text ? (
                  <p className="text-xs text-neutral-500">{image.alt_text}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">No recipe images yet.</p>
      )}
    </section>
  )
}
