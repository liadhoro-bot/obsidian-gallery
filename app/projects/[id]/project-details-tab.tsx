import ProjectPaletteCard from './project-palette-card'
import ProjectGalleryCardLazy from './project-gallery-card-lazy'
import type {
  ProjectImage,
  ProjectRow,
  ProjectTheme,
  SerializableError,
} from './types'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'

type Props = {
  project: ProjectRow | null
  projectTheme: ProjectTheme | null
  projectId: string
  projectUnitCount: number
  projectTotalSessionSeconds: number
  projectImages: ProjectImage[]
  projectImagesError: SerializableError | null
  uploadProjectImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
}

function formatSessionDuration(seconds: number) {
  if (!seconds) return '0h 00m'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  return `${hours}h ${minutes.toString().padStart(2, '0')}m`
}

export default function ProjectDetailsTab({
  project,
  projectTheme,
  projectId,
  projectUnitCount,
  projectTotalSessionSeconds,
  projectImages,
  projectImagesError,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
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

      <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wider text-cyan-400">
          Project Data
        </p>
        <h2 className="mt-1 text-xl font-semibold">Stats</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Units
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {projectUnitCount}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Time Spent
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {formatSessionDuration(projectTotalSessionSeconds)}
            </p>
          </div>
        </div>
      </section>

      <ProjectPaletteCard theme={projectTheme} projectId={projectId} />

      <ProjectGalleryCardLazy
        project={project}
        projectId={projectId}
        projectImages={projectImages}
        projectImagesError={projectImagesError}
        uploadProjectImageAction={uploadProjectImageAction}
        setFeaturedProjectImageAction={setFeaturedProjectImageAction}
        deleteProjectImageAction={deleteProjectImageAction}
      />
    </div>
  )
}
