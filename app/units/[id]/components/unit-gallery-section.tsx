'use client'

import type { ChangeEvent, RefObject } from 'react'
import Image from 'next/image'
import GalleryImageCard from '@/app/components/gallery/gallery-image-card'

type UnitImage = {
  id: string
  image_url: string
  is_featured: boolean
  created_at: string
  sort_order: number | null
  alt_text: string | null
  storage_bucket: string | null
  storage_path: string | null
}

type GalleryPreview = {
  file: File
  previewUrl: string
}

export default function UnitGallerySection({
  images,
  isPending,
  galleryFilePreviews,
  selectedGalleryFiles,
  galleryUploadError,
  isEditingGalleryImages,
  selectedGalleryImageIds,
  isConfirmingGalleryDelete,
  fileInputRef,
  cameraInputRef,
  onUploadClick,
  onCameraClick,
  onFileChange,
  onRemovePendingGalleryFile,
  onUploadSelectedGalleryFiles,
  onClearPendingGalleryFiles,
  onToggleEditingGalleryImages,
  onToggleGalleryImageSelection,
  onSelectAllGalleryImages,
  onClearSelectedGalleryImages,
  onDeleteSelectedGalleryImages,
  onRequestDeleteSelectedGalleryImages,
  onToggleFeatured,
}: {
  images: UnitImage[]
  isPending: boolean
  galleryFilePreviews: GalleryPreview[]
  selectedGalleryFiles: File[]
  galleryUploadError: string | null
  isEditingGalleryImages: boolean
  selectedGalleryImageIds: string[]
  isConfirmingGalleryDelete: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  cameraInputRef: RefObject<HTMLInputElement | null>
  onUploadClick: () => void
  onCameraClick: () => void
  onFileChange: (
    event: ChangeEvent<HTMLInputElement>,
    source: 'gallery_picker' | 'camera'
  ) => void
  onRemovePendingGalleryFile: (index: number) => void
  onUploadSelectedGalleryFiles: () => void
  onClearPendingGalleryFiles: () => void
  onToggleEditingGalleryImages: () => void
  onToggleGalleryImageSelection: (imageId: string) => void
  onSelectAllGalleryImages: () => void
  onClearSelectedGalleryImages: () => void
  onDeleteSelectedGalleryImages: () => void
  onRequestDeleteSelectedGalleryImages: () => void
  onToggleFeatured: (imageId: string) => void
}) {
  return (
    <section className="mt-10">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Inspiration & Art Gallery</h2>
          <p className="text-sm text-white/50">
            Concept art, stage photos, and reference images
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onUploadClick}
            className="tap-press mobile-upload-action rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 hover:border-cyan-300/35 hover:text-cyan-100"
          >
            Upload from Gallery
          </button>
          <button
            type="button"
            onClick={onCameraClick}
            className="tap-press mobile-upload-action rounded-xl bg-cyan-400 px-3 py-2 text-xs font-bold text-black hover:bg-cyan-300"
          >
            Take Photo
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => onFileChange(event, 'gallery_picker')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => onFileChange(event, 'camera')}
      />

      {galleryFilePreviews.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="grid grid-cols-3 gap-2">
            {galleryFilePreviews.map((preview, index) => (
              <div
                key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30"
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
                  onClick={() => onRemovePendingGalleryFile(index)}
                  className="tap-press absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-xs font-black text-white"
                  aria-label={`Remove ${preview.file.name}`}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          {galleryUploadError ? (
            <p className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
              {galleryUploadError}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onUploadSelectedGalleryFiles}
              disabled={isPending || selectedGalleryFiles.length === 0}
              className="tap-press tap-target inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
            >
              {isPending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              <span>
                {isPending
                  ? selectedGalleryFiles.length > 1
                    ? 'Uploading images...'
                    : 'Uploading image...'
                  : selectedGalleryFiles.length > 1
                    ? `Upload ${selectedGalleryFiles.length} images`
                    : 'Upload image'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClearPendingGalleryFiles}
              className="tap-press tap-target rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : galleryUploadError ? (
        <p className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
          {galleryUploadError}
        </p>
      ) : null}

      {images.length > 0 ? (
        <>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onToggleEditingGalleryImages}
              className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
            >
              {isEditingGalleryImages ? 'Done' : 'Edit'}
            </button>
          </div>

          {isEditingGalleryImages ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-semibold text-white/55">
                {selectedGalleryImageIds.length > 0
                  ? `${selectedGalleryImageIds.length} selected`
                  : 'Select images to erase'}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSelectAllGalleryImages}
                  className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
                >
                  Select All
                </button>

                {selectedGalleryImageIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClearSelectedGalleryImages}
                    className="tap-press rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70"
                  >
                    Clear
                  </button>
                ) : null}

                {selectedGalleryImageIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={
                      isConfirmingGalleryDelete
                        ? onDeleteSelectedGalleryImages
                        : onRequestDeleteSelectedGalleryImages
                    }
                    disabled={isPending}
                    className="tap-press rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {isPending
                      ? 'Deleting...'
                      : isConfirmingGalleryDelete
                        ? `Erase ${selectedGalleryImageIds.length}`
                        : 'Delete Selected'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-3">
        {images.map((image) => (
          <div key={image.id} className="relative">
            {isEditingGalleryImages ? (
              <label className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20">
                <input
                  type="checkbox"
                  checked={selectedGalleryImageIds.includes(image.id)}
                  onChange={() => onToggleGalleryImageSelection(image.id)}
                  className="h-4 w-4 accent-red-500"
                  aria-label="Select image for deletion"
                />
              </label>
            ) : null}

            <GalleryImageCard
              image={image}
              canEdit={true}
              onToggleFeatured={async (imageId) => {
                onToggleFeatured(imageId)
              }}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={onUploadClick}
          className="tap-card flex aspect-square min-h-24 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[0.03] text-sm font-medium text-white/60"
        >
          Upload Reference
        </button>
      </div>
    </section>
  )
}
