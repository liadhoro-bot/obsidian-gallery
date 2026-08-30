'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import BackButton from '../../components/back-button'
import FeatureGuideTour from '../../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../../components/feature-guide-navigation'
import ProjectDetailTabs from './project-detail-tabs'
import ProjectDetailsTab from './project-details-tab'
import ProjectUnitsTab from './project-units-tab'
import DeleteProjectCard from './delete-project-card'
import type {
  ProjectImage,
  ProjectRow,
  ProjectTheme,
  ProjectUnit,
  SerializableError,
  UnitImage,
  UnitStage,
} from './types'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import styles from './project-detail-silver.module.css'

type Props = {
  activeTab: ProjectDetailTab
  project: ProjectRow | null
  projectTheme: ProjectTheme | null
  projectError: SerializableError | null
  projectId: string
  featuredProjectImage: ProjectImage | null
  projectImages: ProjectImage[]
  projectUnitCount: number
  projectTotalSessionSeconds: number
  units: ProjectUnit[]
  unitsError: SerializableError | null
  allStagesError: SerializableError | null
  allUnitImagesError: SerializableError | null
  projectImagesError: SerializableError | null
  stagesByUnitId: Record<string, UnitStage[]>
  imagesByUnitId: Record<string, UnitImage[]>
  addUnitAction: (formData: FormData) => Promise<void>
  updateProjectHeaderAction: (formData: FormData) => Promise<void>
  setFeaturedUnitAction: (formData: FormData) => Promise<void>
  uploadProjectImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectAction: (formData: FormData) => Promise<void>
  featureGuides?: FeatureGuideEntry[]
}

export type ProjectDetailTab = 'details' | 'units'

export default function ProjectDetailClient({
  activeTab,
  project,
  projectTheme,
  projectError,
  projectId,
  featuredProjectImage,
  projectImages,
  projectUnitCount,
  projectTotalSessionSeconds,
  units,
  unitsError,
  projectImagesError,
  stagesByUnitId,
  imagesByUnitId,
  addUnitAction,
  updateProjectHeaderAction,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
  deleteProjectAction,
  featureGuides = [],
}: Props) {
  const router = useRouter()
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const projectName = project?.name || 'Untitled Project'
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function handleUpdateHeader(formData: FormData) {
    startTransition(async () => {
      await updateProjectHeaderAction(formData)
      setIsEditingHeader(false)
      router.refresh()
    })
  }

  return (
    <div className={styles.projectDetailClient}>
      <div className={styles.projectHero}>
        {featuredProjectImage ? (
          <Image
            src={featuredProjectImage.image_url}
            alt={featuredProjectImage.alt_text || projectName}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            priority
            className="object-cover"
          />
        ) : (
          <div className={styles.projectHeroFallback} />
        )}

        <div className={styles.projectHeroOverlay} />

        <div className={styles.heroControls}>
          <BackButton fallbackHref="/projects" className={styles.headerControl} />

          <button
            type="button"
            aria-expanded={activeGuide !== null}
            aria-label="Show project explanation"
            data-feature-guide-launcher-button="true"
            onClick={() => {
              if (featureGuides.length) {
                setActiveGuideIndex(
                  findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0
                )
              }
            }}
            className={styles.secondaryButton}
          >
            <span>?</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingHeader((current) => !current)}
            className={styles.secondaryButton}
          >
            <span>{isEditingHeader ? 'Close' : 'Edit'}</span>
          </button>
        </div>

        <div className={styles.heroTitle}>
          <p className={styles.eyebrow}>
            Project Detail
          </p>
          <h1 data-feature-guide-target="projects.detail.page">
            {projectName}
          </h1>
        </div>
      </div>

      {isEditingHeader ? (
        <section className={`${styles.editPanel} mt-4`}>
          <form action={handleUpdateHeader}>
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-3">
              <div className={styles.formField}>
                <label className="mb-1 block">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={projectName}
                  required
                  className="px-3 py-2"
                />
              </div>

              <div className={styles.formField}>
                <label className="mb-1 block">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={project?.description || ''}
                  rows={3}
                  className="px-3 py-2"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className={`${styles.primaryButton} inline-flex items-center justify-center gap-2 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  <span>{isPending ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingHeader(false)}
                  className={`${styles.secondaryAction} px-4 py-2 font-bold`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 border-t border-[color:var(--og-border-subtle)] pt-4">
            <DeleteProjectCard
              projectId={projectId}
              deleteProjectAction={deleteProjectAction}
            />
          </div>
        </section>
      ) : null}

      <ProjectDetailTabs activeTab={activeTab} projectId={projectId} />

      {projectError ? (
        <pre className="mt-5 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
          {JSON.stringify(projectError, null, 2)}
        </pre>
      ) : null}

      {activeTab === 'details' ? (
        <ProjectDetailsTab
          project={project}
          projectTheme={projectTheme}
          projectId={projectId}
          projectUnitCount={projectUnitCount}
          projectTotalSessionSeconds={projectTotalSessionSeconds}
          projectImages={projectImages}
          projectImagesError={projectImagesError}
          uploadProjectImageAction={uploadProjectImageAction}
          setFeaturedProjectImageAction={setFeaturedProjectImageAction}
          deleteProjectImageAction={deleteProjectImageAction}
        />
      ) : null}

      {activeTab === 'units' ? (
        <ProjectUnitsTab
          units={units}
          unitsError={unitsError}
          stagesByUnitId={stagesByUnitId}
          imagesByUnitId={imagesByUnitId}
          projectId={projectId}
          addUnitAction={addUnitAction}
        />
      ) : null}

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex ?? 0}
          guide={activeGuide}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            setActiveGuideIndex((current) =>
              findVisibleFeatureGuideIndex(featureGuides, current, 1) ??
              current ??
              0
            )
          }
          onPrevious={() =>
            setActiveGuideIndex((current) =>
              findVisibleFeatureGuideIndex(featureGuides, current, -1) ??
              current ??
              0
            )
          }
          totalGuides={featureGuides.length}
        />
      ) : null}
    </div>
  )
}
