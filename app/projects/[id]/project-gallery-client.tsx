'use client'

type ProjectGalleryClientProps = {
  projectId: string
  projectImages: {
    id: string
    image_url: string
    alt_text: string | null
    is_featured: boolean | null
  }[]
  projectImagesError: { message?: string } | null
}

export default function ProjectGalleryClient({
  projectId,
  projectImages,
  projectImagesError,
}: ProjectGalleryClientProps) {
  if (projectImagesError) {
    return (
      <section className="rounded-3xl border border-red-900 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold text-white">Project Gallery</h2>
        <p className="mt-2 text-sm text-red-300">
          Failed to load gallery.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Project Gallery</h2>
        <span className="text-xs text-neutral-500">{projectId}</span>
      </div>

      {projectImages.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No images yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projectImages.map((image) => (
            <div
              key={image.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3 text-white"
            >
              <p className="truncate">
                {image.alt_text || 'Project image'}
              </p>

              {image.is_featured ? (
                <p className="mt-1 text-xs text-cyan-400">Featured</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}