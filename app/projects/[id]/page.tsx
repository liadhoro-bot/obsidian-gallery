import { createClient } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ProjectDetailClient from './project-detail-client'
import { Suspense } from 'react'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import { deleteProject } from './actions'
import { captureServerEvent } from '../../../utils/analytics/server'
import type { ProjectImage, ProjectRow, UnitImage, UnitStage } from './types'
import {
  getSafeImageExtension,
  type GalleryUploadResult,
  validateGalleryImageFile,
} from '../../../utils/images/gallery-upload'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function addUnit(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const projectId = formData.get('projectId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const modelCountValue = formData.get('modelCount')?.toString().trim()
  const notes = formData.get('notes')?.toString().trim() || null

  if (!projectId || !name) return

  const modelCount = Number(modelCountValue || '1')

  const { data: insertedUnit, error } = await supabase
    .from('units')
    .insert([
      {
        user_id: user.id,
        project_id: projectId,
        name,
        model_count: Number.isNaN(modelCount) ? 1 : modelCount,
        notes,
        is_active: true,
      },
    ])
    .select()
    .single()

  if (error || !insertedUnit) {
    console.error('Error adding unit:', error)
    return
  }

await captureServerEvent({
  distinctId: user.id,
  event: 'unit_created',
  properties: {
    unit_id: insertedUnit.id,
    unit_name: name,
    project_id: projectId,
    model_count: Number.isNaN(modelCount) ? 1 : modelCount,
    has_notes: Boolean(notes),
    source: 'project_page',
  },
})
  const progressSteps = [
    {
      step_key: 'assembled',
      step_label: 'Assembled',
      step_order: 1,
      status: 'pending',
      progress: 0,
    },
    {
      step_key: 'primed',
      step_label: 'Primed',
      step_order: 2,
      status: 'pending',
      progress: 0,
    },
    {
      step_key: 'initial_paints',
      step_label: 'Initial Paints',
      step_order: 3,
      status: 'pending',
      progress: 0,
    },
    {
      step_key: 'fine_details',
      step_label: 'Fine Details',
      step_order: 4,
      status: 'pending',
      progress: 0,
    },
    {
      step_key: 'base_rim',
      step_label: 'Base & Rim',
      step_order: 5,
      status: 'pending',
      progress: 0,
    },
    {
      step_key: 'done',
      step_label: 'Done',
      step_order: 6,
      status: 'pending',
      progress: 0,
    },
  ]

  const newStepRows = progressSteps.map((step) => ({
    unit_id: insertedUnit.id,
    step_key: step.step_key,
    step_label: step.step_label,
    step_order: step.step_order,
    status: step.status,
    progress: step.progress,
  }))

  const { error: newStepsError } = await supabase
    .from('unit_stage_progress')
    .insert(newStepRows)

  if (newStepsError) {
    console.error('Error creating unit progress steps:', newStepsError)
  }

  const legacyStageRows = progressSteps.map((step) => ({
    unit_id: insertedUnit.id,
    stage_key: step.step_key,
    is_done: false,
  }))

  const { error: legacyStageError } = await supabase
    .from('unit_stage_progress')
    .insert(legacyStageRows)

  if (legacyStageError) {
    console.error('Error creating legacy unit stages:', legacyStageError)
  }

  revalidatePath(`/projects/${projectId}`)
}

async function updateProjectHeader(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const projectId = formData.get('projectId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim()

  if (!projectId || !name) return

  await supabase
    .from('projects')
    .update({
      name,
      description: description || null,
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  revalidatePath(`/projects/${projectId}`)
}

async function setFeaturedUnit(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const unitId = formData.get('unitId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!unitId || !projectId) return

  const { error: clearError } = await supabase
    .from('units')
    .update({ is_featured: false })
    .eq('project_id', projectId)

  if (clearError) {
    console.error('Error clearing featured unit:', clearError)
    return
  }

  const { error: setError } = await supabase
    .from('units')
    .update({ is_featured: true })
    .eq('id', unitId)

  if (setError) {
    console.error('Error setting featured unit:', setError)
    return
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}

async function uploadProjectImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const projectId = formData.get('projectId')?.toString()
  const altText = formData.get('altText')?.toString().trim() || null
  const uploadSource =
    formData.get('uploadSource') === 'camera' ? 'camera' : 'gallery_picker'
  const files = formData
    .getAll('image')
    .filter((value): value is File => value instanceof File && value.size > 0)

  if (!projectId || files.length === 0) return

  const { data: existingImages } = await supabase
    .from('image_assets')
    .select('id')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)

  const result: GalleryUploadResult = {
    uploadedCount: 0,
    failed: [],
  }
  const hasExistingImages = Boolean(existingImages && existingImages.length > 0)

  for (const file of files) {
    const validationError = validateGalleryImageFile(file)

    if (validationError) {
      result.failed.push({ fileName: file.name, reason: validationError })
      continue
    }

    const fileExt = getSafeImageExtension(file.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `projects/${projectId}/${fileName}`
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading project image:', uploadError)
      result.failed.push({ fileName: file.name, reason: uploadError.message })
      continue
    }

    const publicUrlResult = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const publicUrl = publicUrlResult?.data?.publicUrl

    if (!publicUrl) {
      result.failed.push({
        fileName: file.name,
        reason: 'Could not generate public URL for uploaded image.',
      })
      continue
    }

    const isFirstImage = !hasExistingImages && result.uploadedCount === 0

    const { error: insertError } = await supabase.from('image_assets').insert([
      {
        user_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        image_url: publicUrl,
        alt_text: altText,
        is_featured: isFirstImage,
        is_primary: isFirstImage,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
      },
    ])

    if (insertError) {
      console.error('Error saving project image asset:', insertError)
      await supabase.storage.from('obsidian-images').remove([filePath])
      result.failed.push({ fileName: file.name, reason: insertError.message })
      continue
    }

    result.uploadedCount += 1

    await captureServerEvent({
      distinctId: user.id,
      event: 'image_uploaded',
      properties: {
        surface: 'project_gallery',
        project_id: projectId,
        entity_id: projectId,
        image_count: 1,
        is_featured: isFirstImage,
        upload_source: uploadSource,
      },
    })
  }

  if (result.uploadedCount > 0) {
    revalidatePath(`/projects/${projectId}`)
  }

  return result
}

async function setFeaturedProjectImage(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const assetId = formData.get('assetId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!assetId || !projectId) return

  const { error: clearError } = await supabase
    .from('image_assets')
    .update({
      is_featured: false,
      is_primary: false,
    })
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)

  if (clearError) {
    console.error('Error clearing project featured image:', clearError)
    return
  }

  const { error: setError } = await supabase
    .from('image_assets')
    .update({
      is_featured: true,
      is_primary: true,
    })
    .eq('id', assetId)

  if (setError) {
    console.error('Error setting project featured image:', setError)
    return
  }

  revalidatePath(`/projects/${projectId}`)
}

async function deleteProjectImage(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const assetId = formData.get('assetId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!assetId || !projectId) return

  const { data: imageToDelete, error: fetchError } = await supabase
    .from('image_assets')
    .select('id, is_featured')
    .eq('id', assetId)
    .single()

  if (fetchError || !imageToDelete) {
    console.error('Error fetching project image:', fetchError)
    return
  }

  const wasFeatured = !!imageToDelete.is_featured

  const { error: deleteError } = await supabase
    .from('image_assets')
    .delete()
    .eq('id', assetId)

  if (deleteError) {
    console.error('Error deleting project image:', deleteError)
    return
  }

  if (wasFeatured) {
    const { data: remainingImages } = await supabase
      .from('image_assets')
      .select('id')
      .eq('entity_type', 'project')
      .eq('entity_id', projectId)
      .order('created_at', { ascending: true })

    const nextImage = remainingImages?.[0]

    if (nextImage) {
      await supabase
        .from('image_assets')
        .update({
          is_featured: true,
          is_primary: true,
        })
        .eq('id', nextImage.id)
    }
  }

  revalidatePath(`/projects/${projectId}`)
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params

  if (!id || id === 'undefined') {
    throw new Error('Missing or invalid project id in route params')
  }

  const { data: project, error: projectError } = await supabase
  .from('projects')
  .select(`
    id,
    name,
    description,
    created_at,
    updated_at,
    user_id,
    theme_id,
    theme:themes (
      id,
      name,
      description,
      theme_paints (
        id,
        sort_order,
        paint_source,
        paint_catalog_id,
        custom_paint_id,
        catalog_paint:paint_catalog (
          id,
          name,
          hex_approx,
          swatch_image_url
        ),
       custom_paint:paints (
  id,
  name,
  color_hex
)
      )
    )
  `)
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, name, notes, created_at, updated_at, project_id, status, is_active')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const unitIds = (units ?? [])
    .map((unit) => unit.id)
    .filter((unitId): unitId is string => Boolean(unitId) && unitId !== 'undefined')

  const [stageProgressResult, progressStepsResult] = unitIds.length
  ? await Promise.all([
      supabase
        .from('unit_stage_progress')
        .select('id, unit_id, stage_key, stage_label, status, created_at')
        .in('unit_id', unitIds),

      supabase
        .from('unit_progress_steps')
        .select('id, unit_id, step_key, step_label, step_order, status, progress')
        .in('unit_id', unitIds),
    ])
  : [
      { data: [], error: null },
      { data: [], error: null },
    ]

const allStages = [
  ...(stageProgressResult.data ?? []),
  ...(progressStepsResult.data ?? []),
]

const allStagesError =
  stageProgressResult.error || progressStepsResult.error

  const { data: allUnitImages, error: allUnitImagesError } = unitIds.length
    ? await supabase
        .from('image_assets')
        .select('id, entity_id, image_url, alt_text, is_featured, created_at')
        .eq('entity_type', 'unit')
        .eq('user_id', user.id)
        .in('entity_id', unitIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null }

  const { data: projectImages, error: projectImagesError } = await supabase
    .from('image_assets')
    .select('id, entity_id, image_url, alt_text, is_featured, created_at, storage_bucket, storage_path')
    .eq('entity_type', 'project')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const stagesByUnitId = ((allStages ?? []) as UnitStage[]).reduce<
    Record<string, UnitStage[]>
  >(
    (acc, stage) => {
      if (!acc[stage.unit_id]) {
        acc[stage.unit_id] = []
      }
      acc[stage.unit_id].push(stage)
      return acc
    },
    {}
  )

  const imagesByUnitId = ((allUnitImages ?? []) as UnitImage[]).reduce<
    Record<string, UnitImage[]>
  >(
    (acc, image) => {
      if (!acc[image.entity_id]) {
        acc[image.entity_id] = []
      }
      acc[image.entity_id].push(image)
      return acc
    },
    {}
  )

  const projectImageRows = (projectImages ?? []) as ProjectImage[]
  const featuredProjectImage =
    projectImageRows.find((image) => image.is_featured) ||
    projectImageRows[0] ||
    null
  const projectTheme = firstRelation(project?.theme)
  const normalizedProject = project
    ? ({
        ...project,
        theme: projectTheme
          ? {
              ...projectTheme,
              theme_paints:
                projectTheme.theme_paints?.map((paint) => ({
                  ...paint,
                  catalog_paint: firstRelation(paint.catalog_paint),
                  custom_paint: firstRelation(paint.custom_paint),
                })) ?? [],
            }
          : null,
      } as ProjectRow)
    : null

  return (
  <main className="min-h-screen bg-[#081018] text-white">
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
      <Suspense fallback={null}>
        <DashboardTopBar />
      </Suspense>

      <ProjectDetailClient
        project={normalizedProject}
        projectTheme={normalizedProject?.theme ?? null}
        projectError={projectError}
        projectId={id}
        featuredProjectImage={featuredProjectImage}
        projectImages={projectImageRows}
        units={units ?? []}
        unitsError={unitsError}
        allStagesError={allStagesError}
        allUnitImagesError={allUnitImagesError}
        projectImagesError={projectImagesError}
        stagesByUnitId={stagesByUnitId}
        imagesByUnitId={imagesByUnitId}
        addUnitAction={addUnit}
        updateProjectHeaderAction={updateProjectHeader}
        setFeaturedUnitAction={setFeaturedUnit}
        uploadProjectImageAction={uploadProjectImage}
        setFeaturedProjectImageAction={setFeaturedProjectImage}
        deleteProjectImageAction={deleteProjectImage}
        deleteProjectAction={deleteProject}
      />
    </div>
  </main>
)
}
