import ProjectPaletteCard from './project-palette-card'
import ProjectGalleryCardLazy from './project-gallery-card-lazy'
import type {
  ProjectImage,
  ProjectRow,
  ProjectTheme,
  SerializableError,
} from './types'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'
import styles from './project-detail-silver.module.css'

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
    <div className={styles.detailsStack}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>
          Description
        </p>
        <h2 className="mt-1 text-xl">Project Notes</h2>
        <p className="mt-3 text-sm leading-6">
          {project?.description || 'No description'}
        </p>
      </section>

      <section className={styles.panel}>
        <p className={styles.eyebrow}>
          Project Data
        </p>
        <h2 className="mt-1 text-xl">Stats</h2>
        <div className={styles.metricGrid}>
          <div className={styles.metric}>
            <p>
              Units
            </p>
            <p className="mt-2 truncate">
              {projectUnitCount}
            </p>
          </div>

          <div className={styles.metric}>
            <p>
              Time Spent
            </p>
            <p className="mt-2 truncate">
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
