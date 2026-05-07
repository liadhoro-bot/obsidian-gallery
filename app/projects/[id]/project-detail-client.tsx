'use client'

import { useState } from 'react'
import ProjectDetailTabs from './project-detail-tabs'
import ProjectDetailsTab from './project-details-tab'
import ProjectUnitsTab from './project-units-tab'
import ProjectAddUnitTab from './project-add-unit-tab'

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

export type ProjectDetailTab = 'details' | 'units' | 'add'

export default function ProjectDetailClient({
  project,
  projectError,
  projectId,
  featuredProjectImage,
  projectImages,
  units,
  unitsError,
  projectImagesError,
  stagesByUnitId,
  imagesByUnitId,
  addUnitAction,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
}: Props) {
  const [activeTab, setActiveTab] = useState<ProjectDetailTab>('details')

  return (
    <div className="w-full">
      <a href="/projects" className="text-sm text-cyan-400">
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

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Project Detail
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">{project?.name}</h1>
      </div>

      <ProjectDetailTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {projectError ? (
        <pre className="mt-5 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
          {JSON.stringify(projectError, null, 2)}
        </pre>
      ) : null}

      {activeTab === 'details' ? (
        <ProjectDetailsTab
          project={project}
          projectId={projectId}
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