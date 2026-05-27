'use client'

import { useState } from 'react'
import SubmitButton from '../../components/SubmitButton'

type Props = {
  project: any
  projectId: string
  projectImages: any[]
  projectImagesError: any
  uploadProjectImageAction: (formData: FormData) => Promise<void>
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
  const [selectedImage, setSelectedImage] = useState<any | null>(null)
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null)

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
          action={uploadProjectImageAction}
          encType="multipart/form-data"
          className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
        >
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Image
              </label>
              <input
                type="file"
                name="image"
                accept="image/*"
                required
                className="w-full text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-black"
              />
            </div>

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
              idleText="Upload image"
              pendingText="Uploading image..."
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black"
            />
          </div>
        </form>
      ) : null}

      {projectImagesError ? (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
          {JSON.stringify(projectImagesError, null, 2)}
        </pre>
      ) : projectImages.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {projectImages.map((image) => (
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
  <img
    src={image.image_url}
    alt={image.alt_text || project?.name || 'Project image'}
    className="h-28 w-full rounded-xl object-cover transition hover:scale-[1.02]"
  />
</button>

                <div className="absolute right-2 top-2 flex items-center gap-2">
                  {image.is_featured ? (
                    <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                      Featured
                    </span>
                  ) : (
                    <form action={setFeaturedProjectImageAction}>
                      <input type="hidden" name="assetId" value={image.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <SubmitButton
                        idleText="★"
                        pendingText="..."
                        className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                      />
                    </form>
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
                    <form action={deleteProjectImageAction}>
                      <input type="hidden" name="assetId" value={image.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <SubmitButton
                        idleText="Delete"
                        pendingText="Deleting..."
                        className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white"
                      />
                    </form>

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
      <img
        src={selectedImage.image_url}
        alt={
          selectedImage.alt_text ||
          project?.name ||
          'Project image'
        }
        className="max-h-[92vh] rounded-2xl object-contain"
      />
    </div>
  </div>
)}
    </section>
  )
}