'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { ChangeEvent } from 'react'
import SubmitButton from '../../components/SubmitButton'
import type { ProjectImage, ProjectRow, SerializableError } from './types'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'

type Props = {
  project: ProjectRow | null
  projectId: string
  projectImages: ProjectImage[]
  projectImagesError: SerializableError | null
  uploadProjectImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
}

export default function ProjectGalleryCard({
  project,
  projectId,
  projectImages,
  projectImagesError,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
}: Props) {
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ProjectImage | null>(null)
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadSource, setUploadSource] = useState<
    'gallery_picker' | 'camera'
  >('gallery_picker')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [localImages, setLocalImages] = useState(projectImages)
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
    setLocalImages(projectImages)
  }, [projectImages])

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
    uploadFormData.set('projectId', projectId)
    uploadFormData.set('altText', formData.get('altText')?.toString() || '')
    uploadFormData.set('uploadSource', uploadSource)
    selectedFiles.forEach((file) => uploadFormData.append('image', file))

    setUploadError(null)

    const result = await uploadProjectImageAction(uploadFormData)

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
    formData.set('assetId', imageId)
    formData.set('projectId', projectId)

    setActionError(null)
    setLocalImages((current) =>
      current.map((image) => ({
        ...image,
        is_featured: image.id === imageId,
      }))
    )

    startTransition(async () => {
      try {
        await setFeaturedProjectImageAction(formData)
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
    formData.set('assetId', imageId)
    formData.set('projectId', projectId)

    setActionError(null)
    setDeleteConfirmImageId(null)
    setLocalImages((current) => current.filter((image) => image.id !== imageId))

    startTransition(async () => {
      try {
        await deleteProjectImageAction(formData)
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
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider text-cyan-400">
            Project Gallery
          </p>
          <h2 className="mt-1 text-xl font-semibold">Images</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Upload project images and choose one for the page header.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingImage((current) => !current)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-lg text-white transition active:scale-[0.98] active:opacity-70 hover:bg-neutral-700"
          aria-label={isAddingImage ? 'Close add image form' : 'Add image'}
          title={isAddingImage ? 'Close' : 'Add image'}
        >
          {isAddingImage ? '×' : '+'}
        </button>
      </div>

      {isAddingImage ? (
        <form
          action={handleUpload}
          encType="multipart/form-data"
          className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
        >
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-3">
            <div>
              <span className="mb-2 block text-sm text-neutral-300">
                Image
              </span>
              <input
                type="file"
                name="image"
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
                  className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-400/50 hover:text-cyan-100"
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
                    className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
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
                Alt text
              </label>
              <input
                type="text"
                name="altText"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                placeholder="Optional alt text"
              />
            </div>

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
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black"
            />
          </div>
        </form>
      ) : null}

      {actionError ? (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      {projectImagesError ? (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
          {JSON.stringify(projectImagesError, null, 2)}
        </pre>
      ) : localImages.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {localImages.map((image) => (
            <div
              key={image.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-950 p-2"
            >
              <div className="relative">
                <button
  type="button"
  onClick={() => setSelectedImage(image)}
  className="block w-full"
>
  <Image
    src={image.image_url}
    alt={image.alt_text || project?.name || 'Project image'}
    width={240}
    height={112}
    sizes="(max-width: 640px) 50vw, 140px"
    className="h-28 w-full rounded-xl object-cover transition hover:scale-[1.02]"
  />
</button>

                <div className="absolute right-2 top-2 flex items-center gap-2">
                  {image.is_featured ? (
                    <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                      Featured
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetFeatured(image.id)}
                      disabled={isPending}
                      className="rounded-full bg-black/70 px-2 py-1 text-xs text-white disabled:opacity-60"
                    >
                      *
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirmImageId(
                        deleteConfirmImageId === image.id ? null : image.id
                      )
                    }
                    className="rounded-full bg-black/70 px-2 py-1 text-xs text-white transition active:scale-[0.98] active:opacity-70"
                    title="Delete image"
                  >
                    X
                  </button>
                </div>
              </div>

              {deleteConfirmImageId === image.id ? (
                <div className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2">
                  <p className="text-xs text-red-200">Delete this image?</p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.id)}
                      disabled={isPending}
                      className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      {isPending ? 'Deleting...' : 'Delete'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmImageId(null)}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-white transition active:scale-[0.98] active:opacity-70"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          No gallery images yet.
        </p>
      )}
      {selectedImage && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    onClick={() => setSelectedImage(null)}
  >
    <button
      type="button"
      onClick={() => setSelectedImage(null)}
      className="absolute right-4 top-4 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur"
    >
      Close
    </button>

    <div
      className="max-h-[92vh] max-w-6xl overflow-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <Image
        src={selectedImage.image_url}
        alt={
          selectedImage.alt_text ||
          project?.name ||
          'Project image'
        }
        width={1400}
        height={1400}
        sizes="100vw"
        className="max-h-[92vh] rounded-2xl object-contain"
      />
    </div>
  </div>
)}
    </section>
  )
}
