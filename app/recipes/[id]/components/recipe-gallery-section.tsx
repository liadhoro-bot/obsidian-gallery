'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
  const [uploadSource, setUploadSource] = useState<
    'gallery_picker' | 'camera'
  >('gallery_picker')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [localImages, setLocalImages] = useState(recipeImages)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const filePreviews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    [selectedFiles]
  )

  useEffect(() => {
    setLocalImages(recipeImages)
  }, [recipeImages])

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) =>
        URL.revokeObjectURL(preview.previewUrl)
      )
    }
  }, [filePreviews])

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
    source: 'gallery_picker' | 'camera'
  ) {
    setUploadError(null)
    setUploadSource(source)
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
    uploadFormData.set('uploadSource', uploadSource)
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
      if (result?.uploadedImages?.length) {
        setLocalImages((current) => [
          ...result.uploadedImages!,
          ...current.map((image) =>
            result.uploadedImages!.some((uploaded) => uploaded.is_featured)
              ? { ...image, is_featured: false }
              : image
          ),
        ])
      }
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
      }
    }
  }

  function handleSetFeatured(imageId: string) {
    const previousImages = localImages
    const formData = new FormData()
    formData.set('recipeId', recipe.id)
    formData.set('imageId', imageId)

    setActionError(null)
    setLocalImages((current) =>
      current.map((image) => ({
        ...image,
        is_featured: image.id === imageId,
      }))
    )

    startTransition(async () => {
      try {
        await setFeaturedRecipeImageAction(formData)
      } catch (error) {
        setLocalImages(previousImages)
        setActionError(
          error instanceof Error ? error.message : 'Could not update image.'
        )
      }
    })
  }

  function handleDeleteImage(imageId: string) {
    const previousImages = localImages
    const formData = new FormData()
    formData.set('recipeId', recipe.id)
    formData.set('imageId', imageId)

    setActionError(null)
    setDeleteConfirmImageId(null)
    setLocalImages((current) => current.filter((image) => image.id !== imageId))

    startTransition(async () => {
      try {
        await deleteRecipeImageAction(formData)
      } catch (error) {
        setLocalImages(previousImages)
        setDeleteConfirmImageId(imageId)
        setActionError(
          error instanceof Error ? error.message : 'Could not delete image.'
        )
      }
    })
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
              <span className="mb-2 block text-sm text-neutral-300">
                Upload Image
              </span>
              <input
                name="image"
                type="file"
                accept="image/*"
                multiple
                ref={fileInputRef}
                onChange={(event) =>
                  handleFileSelection(event, 'gallery_picker')
                }
                className="hidden"
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                onChange={(event) => handleFileSelection(event, 'camera')}
                className="hidden"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-400/50 hover:text-cyan-100"
                >
                  Upload from Gallery
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
                >
                  Take Photo
                </button>
              </div>
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

      {actionError ? (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      {localImages.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {localImages.map((image) => (
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
                    <button
                      type="button"
                      onClick={() => handleSetFeatured(image.id)}
                      disabled={isPending}
                      className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white disabled:opacity-60"
                      title="Set as featured"
                    >
                        ★
                      </button>
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
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(image.id)}
                        disabled={isPending}
                        className="rounded-xl border border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-60"
                      >
                        {isPending ? 'Deleting...' : 'Delete'}
                      </button>

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
