'use server'

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../../utils/images/gallery-upload'
import { createPerfTimer } from '../../../utils/perf/server'
import { createClient } from '../../../utils/supabase/server'

type CreateUnitResult =
  | {
      ok: true
      unitId: string
    }
  | {
      ok: false
      error: string
    }

export async function createStandaloneUnitAction(
  formData: FormData
): Promise<CreateUnitResult> {
  const perf = createPerfTimer('action:createStandaloneUnit')
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (userError || !user) {
    return {
      ok: false,
      error: 'You must be logged in to create a unit.',
    }
  }

  const projectName = String(formData.get('projectName') || '').trim()
  const rawProjectMode = String(formData.get('projectMode') || 'new')
  const projectMode = rawProjectMode === 'existing' ? 'existing' : 'new'
  const selectedProjectIds = Array.from(
    new Set(
      formData
        .getAll('projectIds')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )
  const unitName = String(formData.get('unitName') || '').trim()
  const modelCountValue = String(formData.get('modelCount') || '1').trim()
  const deadline = String(formData.get('deadline') || '').trim() || null
  const notes = String(formData.get('notes') || '').trim() || null
  const image = formData.get('image')

  if (!unitName) {
    return {
      ok: false,
      error: 'Unit name is required.',
    }
  }

  if (projectMode === 'new' && !projectName) {
    return {
      ok: false,
      error: 'Project name is required.',
    }
  }

  if (projectMode === 'existing' && selectedProjectIds.length === 0) {
    return {
      ok: false,
      error: 'Choose at least one project.',
    }
  }

  const modelCount = Number(modelCountValue || '1')

  if (image instanceof File && image.size > 0) {
    const validationError = validateGalleryImageFile(image)

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      }
    }
  }

  let linkedProjectIds: string[] = []

  if (projectMode === 'existing') {
    const { data: allowedProjects, error: allowedProjectsError } =
      await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .in('id', selectedProjectIds)

    if (allowedProjectsError) {
      return {
        ok: false,
        error: allowedProjectsError.message,
      }
    }

    const allowedProjectIds = new Set(
      (allowedProjects ?? []).map((project) => project.id)
    )

    if (selectedProjectIds.some((projectId) => !allowedProjectIds.has(projectId))) {
      return {
        ok: false,
        error: 'Invalid parent project.',
      }
    }

    linkedProjectIds = selectedProjectIds
  } else {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectName,
        description: 'Created from Start Project / Unit.',
      })
      .select('id')
      .single()

    if (projectError || !project) {
      return {
        ok: false,
        error: projectError?.message || 'Could not create the project.',
      }
    }

    linkedProjectIds = [project.id]
    perf.mark('project Supabase mutation')
  }

  const primaryProjectId = linkedProjectIds[0]

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .insert({
      user_id: user.id,
      project_id: primaryProjectId,
      name: unitName,
      model_count: Number.isNaN(modelCount) ? 1 : modelCount,
      deadline,
      notes,
      is_active: true,
      is_featured: true,
    })
    .select('id')
    .single()

  if (unitError || !unit) {
    return {
      ok: false,
      error: unitError?.message || 'Could not create the unit.',
    }
  }
  perf.mark('unit Supabase mutation')

  const { error: unitProjectsError } = await supabase
    .from('unit_projects')
    .insert(
      linkedProjectIds.map((projectId) => ({
        unit_id: unit.id,
        project_id: projectId,
        user_id: user.id,
      }))
    )

  if (unitProjectsError) {
    return {
      ok: false,
      error: unitProjectsError.message,
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'unit_created',
    properties: {
      unit_id: unit.id,
      unit_name: unitName,
      project_id: primaryProjectId,
      project_ids: linkedProjectIds,
      model_count: Number.isNaN(modelCount) ? 1 : modelCount,
      has_deadline: Boolean(deadline),
      has_notes: Boolean(notes),
      source: 'standalone_unit_form',
    },
  })

  if (image instanceof File && image.size > 0) {
    const fileExt = getSafeImageExtension(image.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `units/${unit.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, image, {
        contentType: image.type,
        upsert: false,
      })

    if (uploadError) {
      return {
        ok: false,
        error: uploadError.message,
      }
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const { error: imageError } = await supabase.from('image_assets').insert({
      user_id: user.id,
      entity_type: 'unit',
      entity_id: unit.id,
      image_url: data.publicUrl,
      alt_text: unitName,
      is_featured: true,
      is_primary: true,
      sort_order: 0,
      storage_bucket: 'obsidian-images',
      storage_path: filePath,
    })

    if (imageError) {
      await supabase.storage.from('obsidian-images').remove([filePath])
      return {
        ok: false,
        error: imageError.message,
      }
    }
    perf.mark('image upload flow')
  }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  linkedProjectIds.forEach((projectId) => {
    revalidatePath(`/projects/${projectId}`)
  })
  revalidatePath(`/units/${unit.id}`)
  perf.total()

  return {
    ok: true,
    unitId: unit.id,
  }
}
