import Image from 'next/image'
import PrefetchLink from '../components/prefetch-link'

export type ProjectWithImage = {
  id: string
  name: string
  description: string | null
  created_at: string
  primaryImage: {
    image_url: string
    alt_text: string | null
  } | null
}

type ProjectLibraryProps = {
  projects: ProjectWithImage[]
}

export default function ProjectLibrary({ projects }: ProjectLibraryProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider text-cyan-400">
            Project Library
          </p>
          <h2 className="mt-1 text-xl font-semibold">My Projects</h2>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {projects.map((project) => (
            <PrefetchLink
              key={project.id}
              href={`/projects/${project.id}`}
              viewportPrefetch
              className="block overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 transition active:scale-[0.98] active:opacity-70 hover:border-cyan-500"
            >
              {project.primaryImage ? (
                <div className="overflow-hidden border-b border-neutral-800">
                  <Image
                    src={project.primaryImage.image_url}
                    alt={project.primaryImage.alt_text || project.name}
                    width={384}
                    height={160}
                    sizes="(max-width: 768px) 100vw, 420px"
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-40 w-full items-center justify-center border-b border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
                  No featured image
                </div>
              )}

              <div className="p-4">
                <h3 className="text-lg font-semibold text-cyan-400">
                  {project.name}
                </h3>

                <p className="mt-3 line-clamp-3 text-sm text-neutral-400">
                  {project.description || 'No description'}
                </p>
              </div>
            </PrefetchLink>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-neutral-400">
          No projects yet. Create your first project to get started.
        </p>
      )}
    </section>
  )
}
