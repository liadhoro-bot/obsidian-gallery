'use client'

import { useMemo } from 'react'
import WorkbenchGallery from '../../components/gallery/workbench-gallery'
import type { ProjectImage, ProjectRow, SerializableError } from './types'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'

export type ProjectGalleryCardProps = {
  project: ProjectRow | null
  projectId: string
  projectImages: ProjectImage[]
  projectImagesError: SerializableError | null
  uploadProjectImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedProjectImageAction: (formData: FormData) => Promise<void>
  deleteProjectImageAction: (formData: FormData) => Promise<void>
  reorderProjectImagesAction: (projectId: string, orderedAssetIds: string[]) => Promise<void>
}

type ProjectGalleryImage = ProjectImage & {
  isFeatured: boolean
  isOptimistic?: boolean
}

function toGalleryImage(image: ProjectImage): ProjectGalleryImage {
  return { ...image, isFeatured: image.is_featured === true }
}

export default function ProjectGalleryCard({
  project,
  projectId,
  projectImages,
  projectImagesError,
  uploadProjectImageAction,
  setFeaturedProjectImageAction,
  deleteProjectImageAction,
  reorderProjectImagesAction,
}: ProjectGalleryCardProps) {
  const projectName = project?.name || 'Project'
  // Stable identity: the gallery re-adopts `images` whenever it changes.
  const images = useMemo(() => projectImages.map(toGalleryImage), [projectImages])

  if (projectImagesError) {
    return (
      <pre className="whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
        {JSON.stringify(projectImagesError, null, 2)}
      </pre>
    )
  }

  return (
    <WorkbenchGallery<ProjectGalleryImage>
      images={images}
      subtitle="project photos and the hero image"
      emptyText="No project photos yet."
      samplerSourceType="project_gallery"
      getSrc={(image) => image.image_url}
      getAlt={(image) => image.alt_text || projectName}
      isPending={(image) => Boolean(image.isOptimistic)}
      createOptimisticImage={(_file, previewUrl) => ({
        id: `optimistic-${crypto.randomUUID()}`,
        image_url: previewUrl,
        alt_text: projectName,
        is_featured: false,
        isFeatured: false,
        isOptimistic: true,
      })}
      uploadImages={async (files, source) => {
        const formData = new FormData()
        formData.set('projectId', projectId)
        formData.set('uploadSource', source)
        files.forEach((file) => formData.append('image', file))

        const result = await uploadProjectImageAction(formData)

        return {
          uploaded: (result?.uploadedImages ?? []).map((image) =>
            toGalleryImage({ ...image, entity_id: projectId })
          ),
          error: result?.failed.length
            ? `Could not upload ${result.failed
                .map((failure) => `${failure.fileName}: ${failure.reason}`)
                .join('; ')}`
            : null,
        }
      }}
      setFeaturedImage={async (imageId) => {
        const formData = new FormData()
        formData.set('assetId', imageId)
        formData.set('projectId', projectId)
        await setFeaturedProjectImageAction(formData)
      }}
      deleteImages={async (imageIds) => {
        const formData = new FormData()
        formData.set('projectId', projectId)
        imageIds.forEach((imageId) => formData.append('assetId', imageId))
        await deleteProjectImageAction(formData)
      }}
      reorderImages={(imageIds) => reorderProjectImagesAction(projectId, imageIds)}
    />
  )
}
