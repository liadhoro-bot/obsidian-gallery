import { createClient } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import MobileNav from '../../components/MobileNav'
import { revalidatePath } from 'next/cache'
import ProjectDetailClient from './project-detail-client'

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
  const file = formData.get('image') as File | null

  if (!projectId || !file || file.size === 0) return

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
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
    throw new Error(`Upload failed: ${JSON.stringify(uploadError)}`)
  }

  const publicUrlResult = supabase.storage
    .from('obsidian-images')
    .getPublicUrl(filePath)

  const publicUrl = publicUrlResult?.data?.publicUrl

  if (!publicUrl) {
    throw new Error('Could not generate public URL for uploaded image')
  }

  const { data: existingImages } = await supabase
    .from('image_assets')
    .select('id')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)

  const isFirstImage = !existingImages || existingImages.length === 0

  const { error: insertError } = await supabase
    .from('image_assets')
    .insert([
      {
        user_id: user.id,
        entity_type: 'project',
        entity_id: projectId,
        image_url: publicUrl,
        alt_text: altText,
        is_featured: isFirstImage,
        is_primary: isFirstImage,
      },
    ])

  if (insertError) {
    console.error('Error saving project image asset:', insertError)
    throw new Error(`Image asset save failed: ${JSON.stringify(insertError)}`)
  }

  revalidatePath(`/projects/${projectId}`)
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
    .select('*')
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
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const unitIds = (units ?? [])
    .map((unit) => unit.id)
    .filter((unitId): unitId is string => Boolean(unitId) && unitId !== 'undefined')

  const { data: allStages, error: allStagesError } = unitIds.length
    ? await supabase
        .from('unit_stage_progress')
        .select('*')
        .in('unit_id', unitIds)
    : { data: [], error: null }

  const { data: allUnitImages, error: allUnitImagesError } = unitIds.length
    ? await supabase
        .from('image_assets')
        .select('*')
        .eq('entity_type', 'unit')
        .eq('user_id', user.id)
        .in('entity_id', unitIds)
        .order('created_at', { ascending: true })
    : { data: [], error: null }

  const { data: projectImages, error: projectImagesError } = await supabase
    .from('image_assets')
    .select('*')
    .eq('entity_type', 'project')
    .eq('entity_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const stagesByUnitId = (allStages ?? []).reduce<Record<string, any[]>>(
    (acc, stage) => {
      if (!acc[stage.unit_id]) {
        acc[stage.unit_id] = []
      }
      acc[stage.unit_id].push(stage)
      return acc
    },
    {}
  )

  const imagesByUnitId = (allUnitImages ?? []).reduce<Record<string, any[]>>(
    (acc, image) => {
      if (!acc[image.entity_id]) {
        acc[image.entity_id] = []
      }
      acc[image.entity_id].push(image)
      return acc
    },
    {}
  )

  const featuredProjectImage =
    (projectImages ?? []).find((image) => image.is_featured) ||
    (projectImages ?? [])[0] ||
    null

  return (
    <ProjectDetailClient
      project={project}
      projectError={projectError}
      projectId={id}
      featuredProjectImage={featuredProjectImage}
      projectImages={projectImages ?? []}
      units={units ?? []}
      unitsError={unitsError}
      allStagesError={allStagesError}
      allUnitImagesError={allUnitImagesError}
      projectImagesError={projectImagesError}
      stagesByUnitId={stagesByUnitId}
      imagesByUnitId={imagesByUnitId}
      addUnitAction={addUnit}
      setFeaturedUnitAction={setFeaturedUnit}
      uploadProjectImageAction={uploadProjectImage}
      setFeaturedProjectImageAction={setFeaturedProjectImage}
      deleteProjectImageAction={deleteProjectImage}
    />
  )
}