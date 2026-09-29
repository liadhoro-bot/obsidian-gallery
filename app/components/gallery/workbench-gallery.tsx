'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import SampleColorFromImageAction from '@/components/color-sampler/SampleColorFromImageAction'
import type { ColorSamplerSource } from '@/components/color-sampler/types'
import { resolveOversizedGalleryImages } from '../../../utils/images/resolve-gallery-image-selection'
import GalleryPager, { useGalleryPages } from './gallery-pager'
import styles from './workbench-gallery.module.css'

// The unit and project galleries, built like the deck editor gallery
// (app/guides/decks/[id]/deck-editor-client.tsx DeckGallery): square tiles,
// an Add Image menu (gallery / camera), an Edit mode for multi-select
// delete and drag-to-reorder, a Hero badge for the page's header image,
// and a full-screen lightbox. Unlike the deck editor - which saves on an
// explicit Save - every change here persists immediately through the
// callbacks, optimistically, and rolls back if the server rejects it.

export type WorkbenchGalleryItem = {
  id: string
  isFeatured: boolean
}

export type WorkbenchGalleryUploadSource = 'gallery_picker' | 'camera'

type DropTarget = {
  id: string
  edge: 'before' | 'after'
}

type Props<T extends WorkbenchGalleryItem> = {
  images: T[]
  subtitle?: string
  emptyText?: string
  getSrc: (image: T) => string
  getAlt: (image: T) => string
  isPending?: (image: T) => boolean
  createOptimisticImage: (file: File, previewUrl: string) => T
  onImagesChange?: (images: T[]) => void
  uploadImages: (
    files: File[],
    source: WorkbenchGalleryUploadSource
  ) => Promise<{ uploaded: T[]; error: string | null }>
  setFeaturedImage: (imageId: string) => Promise<void>
  deleteImages: (imageIds: string[]) => Promise<void>
  reorderImages: (imageIds: string[]) => Promise<void>
  samplerSourceType?: Exclude<ColorSamplerSource, 'vault_upload' | 'vault_camera'>
  featureGuideTarget?: string
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function WorkbenchGallery<T extends WorkbenchGalleryItem>({
  images,
  subtitle = 'Photos and the hero image for this page',
  emptyText = 'No images yet.',
  getSrc,
  getAlt,
  isPending = () => false,
  createOptimisticImage,
  onImagesChange,
  uploadImages,
  setFeaturedImage,
  deleteImages,
  reorderImages,
  samplerSourceType,
  featureGuideTarget,
}: Props<T>) {
  const [localImages, setLocalImages] = useState<T[]>(images)
  const imagesRef = useRef<T[]>(images)
  const [isEditing, setIsEditing] = useState(false)
  const [isAddImageOpen, setIsAddImageOpen] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Server refreshes (revalidatePath) hand us fresh images - adopt them.
  useEffect(() => {
    imagesRef.current = images
    setLocalImages(images)
  }, [images])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const pages = useGalleryPages(localImages)

  const expandedImage =
    localImages.find((image) => image.id === expandedImageId) ?? null

  useEffect(() => {
    if (!expandedImageId) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpandedImageId(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedImageId])

  function commit(updater: (current: T[]) => T[]) {
    const next = updater(imagesRef.current)
    imagesRef.current = next
    setLocalImages(next)
    onImagesChange?.(next)
    return next
  }

  async function addFiles(
    event: ChangeEvent<HTMLInputElement>,
    source: WorkbenchGalleryUploadSource
  ) {
    const input = event.target
    const pickedFiles = Array.from(input.files ?? [])
    input.value = ''
    if (!pickedFiles.length) return

    const { files, error: resolveError } =
      await resolveOversizedGalleryImages(pickedFiles)

    if (resolveError) {
      setError(resolveError)
      return
    }

    if (!files.length) return

    const hadFeatured = imagesRef.current.some((image) => image.isFeatured)
    const optimisticImages = files.map((file, index) => {
      const optimistic = createOptimisticImage(file, URL.createObjectURL(file))
      return { ...optimistic, isFeatured: !hadFeatured && index === 0 }
    })
    const optimisticIds = new Set(optimisticImages.map((image) => image.id))

    setError(null)
    const firstNewIndex = imagesRef.current.length
    commit((current) => [...current, ...optimisticImages])
    // Page to the new photos so the upload is visible.
    pages.showItemAt(firstNewIndex)

    function revokePreviews() {
      optimisticImages.forEach((image) => {
        const src = getSrc(image)
        if (src.startsWith('blob:')) URL.revokeObjectURL(src)
      })
    }

    try {
      const { uploaded, error: uploadError } = await uploadImages(files, source)
      const uploadedFeatured = uploaded.some((image) => image.isFeatured)
      const uploadedIds = new Set(uploaded.map((image) => image.id))

      commit((current) => {
        const firstOptimisticIndex = current.findIndex((image) =>
          optimisticIds.has(image.id)
        )
        // The server refresh can land before this promise resolves and
        // already contain the uploaded rows - drop those so they aren't doubled.
        const remaining = current
          .filter((image) => !optimisticIds.has(image.id) && !uploadedIds.has(image.id))
          .map((image) =>
            uploadedFeatured && image.isFeatured ? { ...image, isFeatured: false } : image
          )
        const insertAt =
          firstOptimisticIndex < 0
            ? remaining.length
            : Math.min(firstOptimisticIndex, remaining.length)

        return [
          ...remaining.slice(0, insertAt),
          ...uploaded,
          ...remaining.slice(insertAt),
        ]
      })

      if (uploadError) setError(uploadError)
    } catch (uploadError) {
      commit((current) => current.filter((image) => !optimisticIds.has(image.id)))
      setError(errorMessage(uploadError, 'Could not upload images.'))
    } finally {
      revokePreviews()
    }
  }

  async function makeHero(image: T) {
    if (image.isFeatured || isPending(image)) return

    const previous = imagesRef.current
    setError(null)
    commit((current) =>
      current.map((item) => ({ ...item, isFeatured: item.id === image.id }))
    )

    try {
      await setFeaturedImage(image.id)
    } catch (featureError) {
      commit(() => previous)
      setError(errorMessage(featureError, 'Could not update the hero image.'))
    }
  }

  function toggleImageSelection(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    )
  }

  async function deleteSelectedImages() {
    const idsToDelete = selectedImageIds.filter((id) =>
      imagesRef.current.some((image) => image.id === id && !isPending(image))
    )
    if (!idsToDelete.length) return

    const previous = imagesRef.current
    const removedHero = previous.some(
      (image) => image.isFeatured && idsToDelete.includes(image.id)
    )
    const next = commit((current) => {
      const kept = current.filter((image) => !idsToDelete.includes(image.id))
      if (!removedHero || kept.length === 0) return kept
      return kept.map((image, index) => ({ ...image, isFeatured: index === 0 }))
    })

    setError(null)
    setSelectedImageIds([])
    setIsEditing(false)

    try {
      await deleteImages(idsToDelete)
      const fallbackHero = removedHero ? next[0] : null
      if (fallbackHero && !isPending(fallbackHero)) {
        await setFeaturedImage(fallbackHero.id)
      }
    } catch (deleteError) {
      commit(() => previous)
      setError(errorMessage(deleteError, 'Could not delete images.'))
    }
  }

  async function reorderImage(imageId: string, targetId: string, edge: DropTarget['edge']) {
    if (imageId === targetId) return

    const previous = imagesRef.current
    const fromIndex = previous.findIndex((image) => image.id === imageId)
    const toIndex = previous.findIndex((image) => image.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const next = [...previous]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    const targetOffset = edge === 'after' ? 1 : 0
    const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
    next.splice(adjustedIndex + targetOffset, 0, moved)

    setError(null)
    commit(() => next)

    try {
      await reorderImages(
        next.filter((image) => !isPending(image)).map((image) => image.id)
      )
    } catch (reorderError) {
      commit(() => previous)
      setError(errorMessage(reorderError, 'Could not save the new order.'))
    }
  }

  const imageCountLabel = `${localImages.length} ${
    localImages.length === 1 ? 'image' : 'images'
  }`

  return (
    <section className={styles.gallery} data-feature-guide-target={featureGuideTarget}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Gallery</h2>
          <p className={styles.subtitle}>
            {imageCountLabel} - {subtitle}
          </p>
        </div>
        <div className={styles.actions}>
          <div className={styles.addImageMenu}>
            <button
              type="button"
              className={styles.addImageButton}
              aria-haspopup="menu"
              aria-expanded={isAddImageOpen}
              onClick={() => setIsAddImageOpen((current) => !current)}
            >
              Add Image
            </button>
            {isAddImageOpen ? (
              <>
                <button
                  type="button"
                  className={styles.addImageBackdrop}
                  aria-label="Close add image menu"
                  onClick={() => setIsAddImageOpen(false)}
                />
                <div className={styles.addImageChoices} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.addImageChoice}
                    onClick={() => {
                      setIsAddImageOpen(false)
                      galleryInputRef.current?.click()
                    }}
                  >
                    From Gallery
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.addImageChoice}
                    onClick={() => {
                      setIsAddImageOpen(false)
                      cameraInputRef.current?.click()
                    }}
                  >
                    From Camera
                  </button>
                </div>
              </>
            ) : null}
          </div>
          {localImages.length ? (
            <button
              type="button"
              className={styles.editToggle}
              onClick={() => {
                setIsEditing((current) => !current)
                setSelectedImageIds([])
              }}
            >
              {isEditing ? 'Done' : 'Edit'}
            </button>
          ) : null}
        </div>
      </header>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={(event) => void addFiles(event, 'gallery_picker')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={(event) => void addFiles(event, 'camera')}
      />

      {isEditing ? (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>
            {selectedImageIds.length
              ? `${selectedImageIds.length} selected`
              : 'Select images to delete or drag to reorder'}
          </span>
          {selectedImageIds.length ? (
            <div className={styles.selectionButtons}>
              <button
                type="button"
                className={styles.selectionButton}
                onClick={() => setSelectedImageIds([])}
              >
                Clear
              </button>
              <button
                type="button"
                className={`${styles.selectionButton} ${styles.deleteButton}`}
                onClick={() => void deleteSelectedImages()}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className={styles.message} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.grid} {...pages.swipeHandlers}>
        {pages.pageItems.map((image, pageIndex) => {
          const index = pages.pageStart + pageIndex
          const pending = isPending(image)
          const src = getSrc(image)
          const alt = getAlt(image)
          const canDrag = isEditing && !pending

          return (
            <article
              key={image.id}
              className={[
                styles.tile,
                draggingImageId === image.id ? styles.tileDragging : '',
                dropTarget?.id === image.id && dropTarget.edge === 'before'
                  ? styles.dropBefore
                  : '',
                dropTarget?.id === image.id && dropTarget.edge === 'after'
                  ? styles.dropAfter
                  : '',
              ].join(' ')}
              draggable={canDrag}
              onDragStart={(event) => {
                if (!canDrag) return
                setDraggingImageId(image.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', image.id)
              }}
              onDragOver={(event) => {
                if (!isEditing || !draggingImageId) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const edge = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                setDropTarget({ id: image.id, edge })
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (!isEditing) return
                event.preventDefault()
                const draggedId = event.dataTransfer.getData('text/plain') || draggingImageId
                if (draggedId) {
                  void reorderImage(draggedId, image.id, dropTarget?.edge ?? 'before')
                }
                setDraggingImageId(null)
                setDropTarget(null)
              }}
              onDragEnd={() => {
                setDraggingImageId(null)
                setDropTarget(null)
              }}
            >
              {isEditing && !pending ? (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={selectedImageIds.includes(image.id)}
                    onChange={() => toggleImageSelection(image.id)}
                    aria-label={`Select photo ${index + 1}`}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className={styles.imageButton}
                onClick={() => setExpandedImageId(image.id)}
                aria-label={`Open photo ${index + 1}`}
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  unoptimized={src.startsWith('blob:')}
                />
              </button>
              {pending ? <span className={styles.pendingVeil}>Uploading</span> : null}
              {!pending ? (
                image.isFeatured ? (
                  <span className={styles.heroBadge}>Hero</span>
                ) : (
                  <button
                    type="button"
                    className={styles.makeHeroButton}
                    onClick={() => void makeHero(image)}
                    aria-label={`Use photo ${index + 1} as the hero image`}
                  >
                    Set Hero
                  </button>
                )
              ) : null}
            </article>
          )
        })}

        {localImages.length === 0 ? <p className={styles.empty}>{emptyText}</p> : null}

        {/* Fill a spare slot on the last page; a full row keeps the header button. */}
        {pages.isLastPage && pages.pageItems.length < pages.pageSize ? (
          <button
            type="button"
            className={styles.uploadTile}
            onClick={() => galleryInputRef.current?.click()}
          >
            Add Image
          </button>
        ) : null}
      </div>

      <GalleryPager
        page={pages.page}
        pageCount={pages.pageCount}
        onPageChange={pages.goToPage}
      />

      {expandedImage && isMounted
        ? createPortal(
            <div
              className={styles.lightbox}
              role="dialog"
              aria-modal="true"
              aria-label={getAlt(expandedImage)}
              onClick={(event) => {
                if (event.target === event.currentTarget) setExpandedImageId(null)
              }}
            >
              {samplerSourceType && !isPending(expandedImage) ? (
                <div className={styles.lightboxTools}>
                  <SampleColorFromImageAction
                    imageSrc={getSrc(expandedImage)}
                    imageAlt={getAlt(expandedImage)}
                    sourceType={samplerSourceType}
                    sourceId={expandedImage.id}
                    label="Match Paint"
                  />
                </div>
              ) : null}
              <button
                type="button"
                className={styles.lightboxClose}
                onClick={() => setExpandedImageId(null)}
              >
                Close
              </button>
              <div className={styles.lightboxImage}>
                <Image
                  src={getSrc(expandedImage)}
                  alt={getAlt(expandedImage)}
                  width={1400}
                  height={1400}
                  sizes="100vw"
                  unoptimized={getSrc(expandedImage).startsWith('blob:')}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  )
}
