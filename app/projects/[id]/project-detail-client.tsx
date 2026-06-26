'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import BackButton from '../../components/back-button'
import ProjectDetailTabs from './project-detail-tabs'
import ProjectDetailsTab from './project-details-tab'
import ProjectUnitsTab from './project-units-tab'
import ProjectAddUnitTab from './project-add-unit-tab'
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
}

export type ProjectDetailTab = 'details' | 'units' | 'add'

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
}: Props) {
  const router = useRouter()
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isPending, startTransition] = useTransition()
  const projectName = project?.name || 'Untitled Project'

  function handleUpdateHeader(formData: FormData) {
    startTransition(async () => {
      await updateProjectHeaderAction(formData)
      setIsEditingHeader(false)
      router.refresh()
    })
  }

  return (
    <div className="w-full">
      <div className="relative h-64 overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
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
          <div className="h-full w-full bg-[#0b1622]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-[#050b12]" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <BackButton fallbackHref="/projects" />

          <button
            type="button"
            onClick={() => setIsEditingHeader((current) => !current)}
            className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/60"
          >
            {isEditingHeader ? 'Close' : 'Edit'}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            Project Detail
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight text-white">
            {projectName}
          </h1>
        </div>
      </div>

      {isEditingHeader ? (
        <section className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <form action={handleUpdateHeader}>
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={projectName}
                  required
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={project?.description || ''}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  <span>{isPending ? 'Saving...' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingHeader(false)}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 border-t border-neutral-800 pt-4">
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
        />
      ) : null}

      {activeTab === 'add' ? (
        <ProjectAddUnitTab
          projectId={projectId}
          addUnitAction={addUnitAction}
        />
      ) : null}
    </div>
  )
}
