import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ProjectDetailClient, { type ProjectDetailTab } from './project-detail-client'
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
import NominateForContestCard from '../../../components/contests/nominate-for-contest-card'
import { getEligibleContestsForSource } from '../../../lib/contests/queries'
import { isCurrentUserAdmin } from '../../../lib/admin'

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
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
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 animate-pulse">
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      throw new Error(validationError)
    }

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
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const publicUrl = data.publicUrl

    const { error: imageError } = await supabase.from('image_assets').insert({
      user_id: user.id,
      entity_type: 'unit',
      entity_id: insertedUnit.id,
      image_url: publicUrl,
      alt_text: name,
      is_featured: true,
      is_primary: true,
      storage_bucket: 'obsidian-images',
      storage_path: filePath,
    })

    if (imageError) {
      await supabase.storage.from('obsidian-images').remove([filePath])
      throw new Error(imageError.message)
    }
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

async function getProjectDetailData({
  projectId,
  userId,
  activeTab,
}: {
  projectId: string
  userId: string
  activeTab: ProjectDetailTab
}) {
  const supabase = await createClient()
  const baseProjectResult = await supabase
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
    .single()

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
      defaultTab: 'add' as ProjectDetailTab,
    }
  }

  const [unitCountResult, featuredProjectImageResult] = await Promise.all([
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('user_id', userId),
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
  ])

  const projectUnitCount = unitCountResult.count ?? 0
  const defaultTab: ProjectDetailTab = projectUnitCount > 0 ? 'units' : 'add'
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
                    hex_approx,
                    swatch_image_url
                  ),
                  custom_paint:paints (
                    id,
                    name,
                    color_hex
                  )
                )
              `)
              .eq('id', project.theme_id)
              .eq('user_id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('image_assets')
          .select('id, entity_id, image_url, alt_text, is_featured, created_at, storage_bucket, storage_path')
          .eq('entity_type', 'project')
          .eq('entity_id', projectId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase
          .from('unit_sessions')
          .select('duration_seconds, unit_id, unit:units!inner(project_id)')
          .eq('user_id', userId)
          .eq('unit.project_id', projectId),
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
      featuredProjectImage: (featuredProjectImageResult.data as ProjectImage | null) ?? null,
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
    const unitsResult = await supabase
      .from('units')
      .select('id, name, notes, created_at, updated_at, project_id, status, is_active')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const units = unitsResult.data ?? []
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
      featuredProjectImage: (featuredProjectImageResult.data as ProjectImage | null) ?? null,
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
    featuredProjectImage: (featuredProjectImageResult.data as ProjectImage | null) ?? null,
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
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await createClient()

  const user = await getSessionUser(supabase)

  if (!user) {
    redirect('/login')
  }

  const { id } = await params

  if (!id || id === 'undefined') {
    throw new Error('Missing or invalid project id in route params')
  }

  const resolvedSearchParams = await searchParams
  const activeTab: ProjectDetailTab =
    resolvedSearchParams.tab === 'details' ||
    resolvedSearchParams.tab === 'units' ||
    resolvedSearchParams.tab === 'add'
      ? resolvedSearchParams.tab
      : 'units'

  const data = await getProjectDetailData({
    projectId: id,
    userId: user.id,
    activeTab,
  })
  const canSeeContestNominationCard = await isCurrentUserAdmin(user.id)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} />
        </Suspense>

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
          deleteProjectAction={deleteProject}
        />
      </div>
    </main>
  )
}
