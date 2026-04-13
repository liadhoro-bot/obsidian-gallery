'use client'

import { useState } from 'react'
import MobileNav from '../../components/MobileNav'

type Props = {
  project: any
  projectError: any
  projectId: string
  featuredProjectImage: any
  projectImages: any[]
  units: any[]
  unitsError: any
  allStagesError: any
  allUnitImagesError: any
  projectImagesError: any
  stagesByUnitId: Record<string, any[]>
  imagesByUnitId: Record<string, any[]>
  addUnitAction: (formData: FormData) => Promise<void>
  setFeaturedUnitAction: (formData: FormData) => Promise<void>
  uploadProjectImageAction: (formData: FormData) => Promise<void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
}

export default function ProjectDetailClient({
  project,
  projectError,
  projectId,
  featuredProjectImage,
  projectImages,
  units,
  unitsError,
  allStagesError,
  allUnitImagesError,
  projectImagesError,
  stagesByUnitId,
  imagesByUnitId,
  addUnitAction,
  setFeaturedUnitAction,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
}: Props) {
  const [isAddingUnit, setIsAddingUnit] = useState(false)
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-black p-6 pb-28 text-white">
      <div className="mx-auto max-w-3xl">
        <MobileNav />

        <a href="/" className="text-cyan-400">
          ← Back to Projects
        </a>

        {featuredProjectImage ? (
          <div className="mt-4 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
            <img
              src={featuredProjectImage.image_url}
              alt={featuredProjectImage.alt_text || project?.name || 'Project image'}
              className="h-64 w-full object-cover"
            />
          </div>
        ) : (
          <div className="mt-4 flex h-64 items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 text-sm text-neutral-500">
            No featured image yet
          </div>
        )}

        {projectError ? (
          <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
            {JSON.stringify(projectError, null, 2)}
          </pre>
        ) : (
          <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
              Project Detail
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white">{project?.name}</h1>

            <p className="mt-3 text-sm text-neutral-400">
              {project?.description || 'No description'}
            </p>

            <div className="mt-4">
              {!isAddingUnit ? (
                <button
                  type="button"
                  onClick={() => setIsAddingUnit(true)}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
                >
                  Add Unit
                </button>
              ) : (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <form action={addUnitAction} className="space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />

                    <div>
                      <label className="mb-1 block text-sm text-neutral-300">
                        Unit Name
                      </label>
                      <input
                        name="name"
                        type="text"
                        required
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                        placeholder="e.g. Skeleton Warriors"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-neutral-300">
                        Model Count
                      </label>
                      <input
                        name="modelCount"
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-neutral-300">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        rows={3}
                        className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                        placeholder="Optional notes"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
                      >
                        Add Unit
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsAddingUnit(false)}
                        className="rounded border border-neutral-700 bg-neutral-800 px-4 py-2 text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                Project Units
              </p>
              <h2 className="mt-1 text-xl font-semibold">Units</h2>
            </div>
          </div>

          {unitsError ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
              {JSON.stringify(unitsError, null, 2)}
            </pre>
          ) : units && units.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {allStagesError || allUnitImagesError ? (
                <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
                  {JSON.stringify(
                    {
                      allStagesError,
                      allUnitImagesError,
                    },
                    null,
                    2
                  )}
                </pre>
              ) : (
                units.map((unit) => {
                  const stages = stagesByUnitId[unit.id] ?? []
                  const images = imagesByUnitId[unit.id] ?? []

                  const primaryImage =
                    images.find((image) => image.is_featured) ||
                    images[0] ||
                    null

                  const completed = stages.filter((s) => s.is_done).length
                  const total = stages.length || 1
                  const percent = Math.round((completed / total) * 100)

                  return (
                    <div
                      key={unit.id}
                      className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 transition hover:border-cyan-500"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/units/${unit.id}`}
                              className="text-lg font-semibold text-cyan-400"
                            >
                              {unit.name}
                            </a>

                            {unit.is_featured && (
                              <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                                Featured
                              </span>
                            )}
                          </div>
                        </div>

                        <form action={setFeaturedUnitAction}>
                          <input type="hidden" name="unitId" value={unit.id ?? ''} />
                          <input type="hidden" name="projectId" value={projectId} />

                          <button
                            type="submit"
                            className={`rounded-lg px-3 py-2 text-xs font-medium ${
                              unit.is_featured
                                ? 'bg-yellow-400 text-black'
                                : 'bg-neutral-800 text-white'
                            }`}
                          >
                            {unit.is_featured ? 'Featured' : 'Set Featured'}
                          </button>
                        </form>
                      </div>

                      {primaryImage ? (
                        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
                          <img
                            src={primaryImage.image_url}
                            alt={unit.name}
                            className="h-40 w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="mt-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
                          No featured image
                        </div>
                      )}

                      <p className="mt-3 text-sm text-neutral-400">
                        {unit.notes || 'No notes'}
                      </p>

                      <div className="mt-4 space-y-1 text-sm text-neutral-500">
                        <p>Models: {unit.model_count}</p>
                        <p>Progress: {completed}/{total} stages ({percent}%)</p>
                      </div>

                      <p className="mt-3">
                        <a
                          href={`/units/${unit.id}`}
                          className="text-sm text-cyan-400 hover:underline"
                        >
                          Open unit page →
                        </a>
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No units yet.</p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
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
    className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-lg text-white transition hover:bg-neutral-700"
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

    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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

      <button
        type="submit"
        className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-black"
      >
        Upload
      </button>
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
                    <img
                      src={image.image_url}
                      alt={image.alt_text || project?.name || 'Project image'}
                      className="h-28 w-full rounded-xl object-cover"
                    />

                    <div className="absolute right-2 top-2 flex items-center gap-2">
                      {image.is_featured ? (
                        <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                          Featured
                        </span>
                      ) : (
                        <form action={setFeaturedProjectImageAction}>
                          <input type="hidden" name="assetId" value={image.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <button
                            type="submit"
                            className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                            title="Set as featured"
                          >
                            ★
                          </button>
                        </form>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmImageId(
                            deleteConfirmImageId === image.id ? null : image.id
                          )
                        }
                        className="rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                        title="Delete image"
                      >
                        X
                      </button>
                    </div>
                  </div>

                  {deleteConfirmImageId === image.id ? (
                    <div className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2">
                      <p className="text-xs text-red-200">
                        Delete this image?
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <form action={deleteProjectImageAction}>
                          <input type="hidden" name="assetId" value={image.id} />
                          <input type="hidden" name="projectId" value={projectId} />
                          <button
                            type="submit"
                            className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white"
                          >
                            Delete
                          </button>
                        </form>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmImageId(null)}
                          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-white"
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
        </section>
      </div>
    </main>
  )
}