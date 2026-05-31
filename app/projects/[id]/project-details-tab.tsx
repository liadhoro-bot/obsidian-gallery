import ProjectPaletteCard from './project-palette-card'
import ProjectGalleryCard from './project-gallery-card'
import DeleteProjectCard from './delete-project-card'
import type {
  ProjectImage,
  ProjectRow,
  ProjectTheme,
  SerializableError,
} from './types'

type Props = {
  project: ProjectRow | null
  projectTheme: ProjectTheme | null
  projectId: string
  projectImages: ProjectImage[]
  projectImagesError: SerializableError | null
  uploadProjectImageAction: (formData: FormData) => Promise<void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectAction: (formData: FormData) => Promise<void>
}

export default function ProjectDetailsTab({
  project,
  projectTheme,
  projectId,
  projectImages,
  projectImagesError,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
  deleteProjectAction,
}: Props) {
  return (
    <div className="mt-5 grid gap-5">
      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wider text-cyan-400">
          Description
        </p>
        <h2 className="mt-1 text-xl font-semibold">Project Notes</h2>
        <p className="mt-3 text-sm text-neutral-400">
          {project?.description || 'No description'}
        </p>
      </section>

      <ProjectPaletteCard theme={projectTheme} projectId={projectId} />

            <ProjectGalleryCard
        project={project}
        projectId={projectId}
        projectImages={projectImages}
        projectImagesError={projectImagesError}
        uploadProjectImageAction={uploadProjectImageAction}
        setFeaturedProjectImageAction={setFeaturedProjectImageAction}
        deleteProjectImageAction={deleteProjectImageAction}
      />

      <DeleteProjectCard
        projectId={projectId}
        deleteProjectAction={deleteProjectAction}
      />
    </div>
  )
}
