import { getProjectUnits } from './project-units-data'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ProjectDetailClient, { type ProjectDetailTab } from './project-detail-client'
import { Suspense } from 'react'
import { deleteProject } from './actions'
import { captureServerEvent } from '../../../utils/analytics/server'
import type { ProjectImage, ProjectRow, UnitImage, UnitStage } from './types'
import {
  getSafeImageExtension,
  type GalleryUploadResult,
  validateGalleryImageFile,
} from '../../../utils/images/gallery-upload'
import NominateForContestCard from '../../../components/contests/nominate-for-contest-card'
import { getEligibleContestsForSource } from '../../../lib/contests/queries'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { hasV3PreviewSession } from '../../../lib/v3-preview-server'
import { getFeatureGuidesForPage } from '../../components/feature-guide-data'
import { projectDetailFeatureGuides } from '../../components/feature-guide-presets'
import styles from './project-detail-silver.module.css'
import {
  completeOnboardingAction,
  completeOnboardingActions,
} from '../../../lib/onboarding/completion'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

type ProjectSupabaseClient = Awaited<ReturnType<typeof createClient>>


async function getOwnedProject(
  supabase: ProjectSupabaseClient,
  projectId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

async function ProjectContestCard({
  userId,
  projectId,
}: {
  userId: string
  projectId: string
}) {
  const eligibleContests = await getEligibleContestsForSource(
    userId,
    'project',
    projectId
  )

  return (
    <NominateForContestCard
      contests={eligibleContests}
      sourceType="project"
      sourceId={projectId}
    />
  )
}

function ProjectContestCardSkeleton() {
  return (
    <section className={`${styles.panel} animate-pulse`}>
      <div className="h-6 w-44 rounded bg-white/10" />
      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-3 h-4 w-32 rounded bg-white/10" />
      </div>
    </section>
  )
}

async function addUnit(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const projectId = formData.get('projectId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const modelCountValue = formData.get('modelCount')?.toString().trim()
  const deadline = formData.get('deadline')?.toString().trim() || null
  const notes = formData.get('notes')?.toString().trim() || null
  const imageFile = formData.get('image')

  if (!projectId || !name) return

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const modelCount = Number(modelCountValue || '1')

  const { data: insertedUnit, error } = await supabase
    .from('units')
    .insert([
      {
        user_id: user.id,
        project_id: projectId,
        name,
        model_count: Number.isNaN(modelCount) ? 1 : modelCount,
        deadline,
        notes,
        is_active: true,
        status: 'active',
      },
    ])
    .select()
    .single()

  if (error || !insertedUnit) {
    console.error('Error adding unit:', error)
    return
  }

  const { error: unitProjectsError } = await supabase
    .from('unit_projects')
    .upsert(
      {
        unit_id: insertedUnit.id,
        project_id: projectId,
        user_id: user.id,
      },
      { onConflict: 'unit_id,project_id' }
    )

  if (unitProjectsError) {
    console.error('Error linking unit to project:', unitProjectsError)
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'unit_created',
    properties: {
      unit_id: insertedUnit.id,
      unit_name: name,
      project_id: projectId,
      model_count: Number.isNaN(modelCount) ? 1 : modelCount,
      has_deadline: Boolean(deadline),
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
    .from('unit_progress_steps')
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

  let persistedUnitImage = false

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      console.error('Skipping invalid unit image:', validationError)
    } else {
      // The photo is optional context for the unit; a flaky upload must not
      // fail unit creation now that the unit row already exists.
      try {
        const fileExt = getSafeImageExtension(imageFile.name)
        const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
        const filePath = `units/${insertedUnit.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('obsidian-images')
          .upload(filePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          })

        if (uploadError) {
          console.error('Unit image upload failed:', uploadError)
        } else {
          const { data } = supabase.storage
            .from('obsidian-images')
            .getPublicUrl(filePath)

          const { error: imageError } = await supabase
            .from('image_assets')
            .insert({
              user_id: user.id,
              entity_type: 'unit',
              entity_id: insertedUnit.id,
              image_url: data.publicUrl,
              alt_text: name,
              is_featured: true,
              is_primary: true,
              storage_bucket: 'obsidian-images',
              storage_path: filePath,
            })

          if (imageError) {
            await supabase.storage.from('obsidian-images').remove([filePath])
            console.error('Failed to create unit image asset:', imageError)
          } else {
            persistedUnitImage = true
          }
        }
      } catch (uploadException) {
        console.error('Unit image upload threw:', uploadException)
      }
    }
  }

  await completeOnboardingActions({
    userId: user.id,
    subjectProjectId: projectId,
    subjectUnitId: insertedUnit.id,
    actionKeys: [
      'create_unit',
      'name_unit',
      'add_project_unit',
      'set_unit_status',
      'add_unit_to_active_bench',
      ...(notes || deadline || modelCount ? ['complete_unit_info'] : []),
      ...(persistedUnitImage ? ['add_unit_image'] : []),
    ],
  })

  revalidatePath(`/projects/${projectId}`)
}

async function updateProjectHeader(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const user = await getSessionUser(supabase)

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

  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const { error: clearError } = await supabase
    .from('units')
    .update({ is_featured: false })
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (clearError) {
    console.error('Error clearing featured unit:', clearError)
    return
  }

  const { error: setError } = await supabase
    .from('units')
    .update({ is_featured: true })
    .eq('id', unitId)
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (setError) {
    console.error('Error setting featured unit:', setError)
    return
  }

  await completeOnboardingAction({
    userId: user.id,
    actionKey: 'feature_unit',
    subjectProjectId: projectId,
    subjectUnitId: unitId,
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}

async function uploadProjectImage(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const user = await getSessionUser(supabase)

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

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const { data: existingImages } = await supabase
    .from('image_assets')
    .select('id, sort_order')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', user.id)

  const result: GalleryUploadResult = {
    uploadedCount: 0,
    failed: [],
    uploadedImages: [],
  }
  const hasExistingImages = Boolean(existingImages && existingImages.length > 0)
  // New photos go to the end of the gallery's manual order.
  let nextSortOrder =
    (existingImages ?? []).reduce(
      (max, image) => Math.max(max, image.sort_order ?? -1),
      -1
    ) + 1

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

    const { data: imageAsset, error: insertError } = await supabase
      .from('image_assets')
      .insert({
        user_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        image_url: publicUrl,
        alt_text: altText,
        is_featured: isFirstImage,
        is_primary: isFirstImage,
        sort_order: nextSortOrder++,
        storage_bucket: 'obsidian-images',
        storage_path: filePath,
      })
      .select(
        'id, image_url, is_featured, created_at, sort_order, alt_text, storage_bucket, storage_path'
      )
      .single()

    if (insertError) {
      console.error('Error saving project image asset:', insertError)
      await supabase.storage.from('obsidian-images').remove([filePath])
      result.failed.push({ fileName: file.name, reason: insertError.message })
      continue
    }

    result.uploadedCount += 1
    if (imageAsset) {
      result.uploadedImages?.push(imageAsset)
    }

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

  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const { error: clearError } = await supabase
    .from('image_assets')
    .update({
      is_featured: false,
      is_primary: false,
    })
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', user.id)

  if (clearError) {
    console.error('Error clearing project featured image:', clearError)
    throw new Error('Could not update the hero image.')
  }

  const { error: setError } = await supabase
    .from('image_assets')
    .update({
      is_featured: true,
      is_primary: true,
    })
    .eq('id', assetId)
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', user.id)

  if (setError) {
    console.error('Error setting project featured image:', setError)
    throw new Error('Could not update the hero image.')
  }

  revalidatePath(`/projects/${projectId}`)
}

async function deleteProjectImage(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const assetIds = formData
    .getAll('assetId')
    .map((value) => value.toString())
    .filter(Boolean)
  const projectId = formData.get('projectId')?.toString()

  if (assetIds.length === 0 || !projectId) return

  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const { data: imagesToDelete, error: fetchError } = await supabase
    .from('image_assets')
    .select('id, is_featured, storage_bucket, storage_path')
    .in('id', assetIds)
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', user.id)

  if (fetchError || !imagesToDelete?.length) {
    console.error('Error fetching project images:', fetchError)
    throw new Error('Could not find those images.')
  }

  const wasFeatured = imagesToDelete.some((image) => image.is_featured)
  const storagePathsByBucket = imagesToDelete.reduce<Record<string, string[]>>(
    (acc, image) => {
      if (image.storage_bucket && image.storage_path) {
        acc[image.storage_bucket] = acc[image.storage_bucket] || []
        acc[image.storage_bucket].push(image.storage_path)
      }
      return acc
    },
    {}
  )

  for (const [bucket, paths] of Object.entries(storagePathsByBucket)) {
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths)

    if (storageError) {
      console.error('Error deleting project image storage objects:', storageError)
      throw new Error('Could not delete images.')
    }
  }

  const { error: deleteError } = await supabase
    .from('image_assets')
    .delete()
    .in(
      'id',
      imagesToDelete.map((image) => image.id)
    )
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Error deleting project images:', deleteError)
    throw new Error('Could not delete images.')
  }

  if (wasFeatured) {
    const { data: remainingImages } = await supabase
      .from('image_assets')
      .select('id')
      .eq('entity_type', 'project')
      .eq('entity_id', projectId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)

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

async function reorderProjectImages(projectId: string, orderedAssetIds: string[]) {
  'use server'

  const supabase = await createClient()

  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Not authenticated')
  }

  const assetIds = orderedAssetIds.filter(
    (assetId) => typeof assetId === 'string' && assetId.length > 0
  )

  if (!projectId || assetIds.length === 0) return

  const project = await getOwnedProject(supabase, projectId, user.id)

  if (!project) {
    throw new Error('Project not found')
  }

  const results = await Promise.all(
    assetIds.map((assetId, index) =>
      supabase
        .from('image_assets')
        .update({ sort_order: index })
        .eq('id', assetId)
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .eq('user_id', user.id)
    )
  )

  const failed = results.find((result) => result.error)
  if (failed?.error) {
    console.error('Error reordering project images:', failed.error)
    throw new Error('Could not save the new image order.')
  }

  revalidatePath(`/projects/${projectId}`)
}

async function getProjectDetailData(args: {
  projectId: string
  userId: string
  activeTab: ProjectDetailTab
}) {
  const supabase = await createClient()
  const { projectId, userId } = args
  // The image is independent of the unit/progress chain. Await both only when
  // assembling the final result, preserving the original rendered content.
  const [data, featuredProjectImageResult, projectFeaturedResult] = await Promise.all([
    getProjectDetailBody({ ...args, supabase }),
    supabase
        .from('image_assets')
        .select('id, entity_id, image_url, alt_text, is_featured, created_at, storage_bucket, storage_path')
        .eq('entity_type', 'project')
        .eq('entity_id', projectId)
        .eq('user_id', userId)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    // Separate query so the page still loads before the projects.is_featured
    // migration is applied (the error just reads as "not featured").
    supabase
      .from('projects')
      .select('is_featured')
      .eq('id', projectId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])
  return {
    ...data,
    featuredProjectImage: data.project
      ? (featuredProjectImageResult.data as ProjectImage | null) ?? null
      : null,
    isProjectFeatured:
      !projectFeaturedResult.error && projectFeaturedResult.data?.is_featured === true,
  }
}

async function getProjectDetailBody({
  supabase,
  projectId,
  userId,
  activeTab,
}: {
  supabase: ProjectSupabaseClient
  projectId: string
  userId: string
  activeTab: ProjectDetailTab
}) {
  const [baseProjectResult, projectUnitIdsResult] =
    await Promise.all([
      supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          user_id,
          theme_id
        `)
        .eq('id', projectId)
        .eq('user_id', userId)
        .single(),
      getProjectUnits(supabase, projectId, userId, activeTab),

    ])

  const project = baseProjectResult.data
  const projectError = baseProjectResult.error

  if (!project) {
    return {
      project: null,
      projectTheme: null,
      projectError,
      featuredProjectImage: null,
      projectImages: [],
      projectUnitCount: 0,
      projectTotalSessionSeconds: 0,
      units: [],
      unitsError: null,
      allStagesError: null,
      allUnitImagesError: null,
      projectImagesError: null,
      stagesByUnitId: {},
      imagesByUnitId: {},
      defaultTab: 'units' as ProjectDetailTab,
    }
  }

  const projectUnitIds = projectUnitIdsResult.ids
  const projectUnitCount = projectUnitIds.length
  const defaultTab: ProjectDetailTab = 'units'
  const projectImagesError = activeTab === 'details' ? null : null

  if (activeTab === 'details') {
    const [projectThemeResult, projectImagesResult, projectSessionsResult] =
      await Promise.all([
        project.theme_id
          ? supabase
              .from('themes')
              .select(`
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
                    brand,
                    line,
                    hex_approx,
                    swatch_image_url
                  ),
                  custom_paint:paints (
                    id,
                    name,
                    manufacturer,
                    series,
                    color_hex
                  )
                )
              `)
              .eq('id', project.theme_id)
              .or(`user_id.eq.${userId},is_public.eq.true`)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('image_assets')
          .select('id, entity_id, image_url, alt_text, is_featured, created_at, storage_bucket, storage_path')
          .eq('entity_type', 'project')
          .eq('entity_id', projectId)
          .eq('user_id', userId)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true }),
        projectUnitIds.length > 0
          ? supabase
              .from('unit_sessions')
              .select('duration_seconds, unit_id')
              .eq('user_id', userId)
              .in('unit_id', projectUnitIds)
          : Promise.resolve({ data: [], error: null }),
      ])

    const projectTheme = projectThemeResult.data
      ? ({
          ...projectThemeResult.data,
          theme_paints:
            projectThemeResult.data.theme_paints?.map((paint) => ({
              ...paint,
              catalog_paint: firstRelation(paint.catalog_paint),
              custom_paint: firstRelation(paint.custom_paint),
            })) ?? [],
        } as ProjectRow['theme'])
      : null

    const normalizedProject = {
      ...project,
      theme: projectTheme,
    } as ProjectRow

    return {
      project: normalizedProject,
      projectTheme,
      projectError,
      featuredProjectImage: null,
      projectImages: (projectImagesResult.data ?? []) as ProjectImage[],
      projectUnitCount,
      projectTotalSessionSeconds: (projectSessionsResult.data ?? []).reduce(
        (total, session) => total + (session.duration_seconds ?? 0),
        0
      ),
      units: [],
      unitsError: null,
      allStagesError: null,
      allUnitImagesError: null,
      projectImagesError: projectImagesResult.error,
      stagesByUnitId: {},
      imagesByUnitId: {},
      defaultTab,
    }
  }

  if (activeTab === 'units') {
    const unitsResult = { data: projectUnitIdsResult.units, error: projectUnitIdsResult.error }
    const units = unitsResult.data

    const unitIds = units
      .map((unit) => unit.id)
      .filter((unitId): unitId is string => Boolean(unitId) && unitId !== 'undefined')

    const [progressStepsResult, allUnitImagesResult] =
      unitIds.length > 0
        ? await Promise.all([
            supabase
              .from('unit_progress_steps')
              .select('id, unit_id, step_key, step_label, step_order, status, progress')
              .in('unit_id', unitIds),
            supabase
              .from('image_assets')
              .select('id, entity_id, image_url, alt_text, is_featured, created_at')
              .eq('entity_type', 'unit')
              .eq('user_id', userId)
              .eq('is_featured', true)
              .in('entity_id', unitIds)
              .order('created_at', { ascending: false }),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ]

    const needsLegacyStages =
      (progressStepsResult.data?.length ?? 0) === 0 && unitIds.length > 0

    const legacyStageProgressResult = needsLegacyStages
      ? await supabase
          .from('unit_stage_progress')
          .select('id, unit_id, stage_key, stage_label, status, created_at')
          .in('unit_id', unitIds)
      : { data: [], error: null }

    const allStages = [
      ...((legacyStageProgressResult.data ?? []) as UnitStage[]),
      ...((progressStepsResult.data ?? []) as UnitStage[]),
    ]
    const stagesByUnitId = allStages.reduce<Record<string, UnitStage[]>>(
      (acc, stage) => {
        if (!acc[stage.unit_id]) {
          acc[stage.unit_id] = []
        }
        acc[stage.unit_id].push(stage)
        return acc
      },
      {}
    )
    const imagesByUnitId = ((allUnitImagesResult.data ?? []) as UnitImage[]).reduce<
      Record<string, UnitImage[]>
    >((acc, image) => {
      if (!acc[image.entity_id]) {
        acc[image.entity_id] = []
      }
      acc[image.entity_id].push(image)
      return acc
    }, {})

    return {
      project: { ...project, theme: null } as ProjectRow,
      projectTheme: null,
      projectError,
      featuredProjectImage: null,
      projectImages: [],
      projectUnitCount,
      projectTotalSessionSeconds: 0,
      units,
      unitsError: unitsResult.error,
      allStagesError:
        legacyStageProgressResult.error || progressStepsResult.error,
      allUnitImagesError: allUnitImagesResult.error,
      projectImagesError,
      stagesByUnitId,
      imagesByUnitId,
      defaultTab,
    }
  }

  return {
    project: { ...project, theme: null } as ProjectRow,
    projectTheme: null,
    projectError,
    featuredProjectImage: null,
    projectImages: [],
    projectUnitCount,
    projectTotalSessionSeconds: 0,
    units: [],
    unitsError: null,
    allStagesError: null,
    allUnitImagesError: null,
    projectImagesError,
    stagesByUnitId: {},
    imagesByUnitId: {},
    defaultTab,
  }
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; preview?: string }>
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  const supabase = await createClient()

  const user = await getSessionUser(supabase)

  if (!user) {
    redirect(
      isPreview
        ? `/login?next=%2Fprojects%2F${encodeURIComponent(id)}%3Fpreview%3D1&preview=1`
        : '/login'
    )
  }

  if (!id || id === 'undefined') {
    throw new Error('Missing or invalid project id in route params')
  }

  const activeTab: ProjectDetailTab =
    resolvedSearchParams.tab === 'details' || resolvedSearchParams.tab === 'units'
      ? resolvedSearchParams.tab
      : 'units'

  const [data, featureGuides, canSeeContestNominationCard] = await Promise.all([
    getProjectDetailData({
      projectId: id,
      userId: user.id,
      activeTab,
    }),
    getFeatureGuidesForPage('/projects/[id]', projectDetailFeatureGuides),
    isCurrentUserAdmin(user.id),
  ])

  return (
    <main className={styles.projectDetailSilver}>
      <div className="flex flex-col">
        {data.project && canSeeContestNominationCard ? (
          <Suspense fallback={<ProjectContestCardSkeleton />}>
            <ProjectContestCard userId={user.id} projectId={id} />
          </Suspense>
        ) : null}

        <ProjectDetailClient
          activeTab={activeTab}
          project={data.project}
          projectTheme={data.projectTheme ?? null}
          projectError={data.projectError}
          projectId={id}
          featuredProjectImage={data.featuredProjectImage}
          isProjectFeatured={data.isProjectFeatured}
          projectImages={data.projectImages}
          projectUnitCount={data.projectUnitCount}
          projectTotalSessionSeconds={data.projectTotalSessionSeconds}
          units={data.units}
          unitsError={data.unitsError}
          allStagesError={data.allStagesError}
          allUnitImagesError={data.allUnitImagesError}
          projectImagesError={data.projectImagesError}
          stagesByUnitId={data.stagesByUnitId}
          imagesByUnitId={data.imagesByUnitId}
          addUnitAction={addUnit}
          updateProjectHeaderAction={updateProjectHeader}
          setFeaturedUnitAction={setFeaturedUnit}
          uploadProjectImageAction={uploadProjectImage}
          setFeaturedProjectImageAction={setFeaturedProjectImage}
          deleteProjectImageAction={deleteProjectImage}
          reorderProjectImagesAction={reorderProjectImages}
          deleteProjectAction={deleteProject}
          featureGuides={featureGuides}
        />
      </div>
    </main>
  )
}
