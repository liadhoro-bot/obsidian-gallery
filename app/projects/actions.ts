'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import {
  completeOnboardingAction,
  completeOnboardingActions,
} from '../../lib/onboarding/completion'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../utils/images/gallery-upload'

const IMAGE_BUCKET = 'obsidian-images'

export type CreateProjectsPageProjectResult =
  | {
      ok: true
      projectId: string
    }
  | {
      ok: false
      error: string
    }

export type CreateProjectsPageUnitResult =
  | {
      ok: true
      unitId: string
    }
  | {
      ok: false
      error: string
    }

export async function addProject(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name')?.toString().trim()
  const descriptionRaw = formData.get('description')?.toString().trim()
  const imageFile = formData.get('image')

  if (!name) {
    throw new Error('Project name is required')
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert([
      {
        user_id: user.id,
        name,
        description: descriptionRaw || null,
      },
    ])
    .select('id')
    .single()

  if (error || !newProject) {
    throw new Error(error?.message || 'Failed to create project')
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      throw new Error(validationError)
    }

    const fileExt = getSafeImageExtension(imageFile.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `projects/${newProject.id}/${fileName}`

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
      entity_type: 'project',
      entity_id: newProject.id,
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

  revalidatePath('/projects')

  await completeOnboardingAction({
    userId: user.id,
    actionKey: 'create_project',
    subjectProjectId: newProject.id,
  })

  redirect(`/projects/${newProject.id}`)
}

export async function createProjectsPageProjectAction(
  formData: FormData
): Promise<CreateProjectsPageProjectResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You must be logged in to create a project.',
    }
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const imageFile = formData.get('image')

  if (!name) {
    return {
      ok: false,
      error: 'Project name is required.',
    }
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      }
    }
  }

  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
    })
    .select('id')
    .single()

  if (error || !newProject) {
    return {
      ok: false,
      error: error?.message || 'Could not create the project.',
    }
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const fileExt = getSafeImageExtension(imageFile.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `projects/${newProject.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(filePath, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      })

    if (uploadError) {
      return {
        ok: false,
        error: uploadError.message,
      }
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath)

    const { error: imageError } = await supabase.from('image_assets').insert({
      user_id: user.id,
      entity_type: 'project',
      entity_id: newProject.id,
      image_url: data.publicUrl,
      alt_text: name,
      is_featured: true,
      is_primary: true,
      storage_bucket: IMAGE_BUCKET,
      storage_path: filePath,
    })

    if (imageError) {
      await supabase.storage.from(IMAGE_BUCKET).remove([filePath])
      return {
        ok: false,
        error: imageError.message,
      }
    }
  }

  await completeOnboardingAction({
    userId: user.id,
    actionKey: 'create_project',
    subjectProjectId: newProject.id,
  })

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath(`/projects/${newProject.id}`)

  return {
    ok: true,
    projectId: newProject.id,
  }
}

export async function createProjectsPageUnitAction(
  formData: FormData
): Promise<CreateProjectsPageUnitResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You must be logged in to create a unit.',
    }
  }

  const name = String(formData.get('name') || '').trim()
  const projectId = String(formData.get('projectId') || '').trim()
  const newProjectName = String(formData.get('newProjectName') || '').trim()
  const deadline = String(formData.get('deadline') || '').trim() || null
  const imageFile = formData.get('image')
  let linkedProjectId =
    projectId && projectId !== 'new' && projectId !== 'unfiled' ? projectId : null
  let createdProjectId: string | null = null

  if (!name) {
    return {
      ok: false,
      error: 'Unit name is required.',
    }
  }

  if (!linkedProjectId && !newProjectName) {
    return {
      ok: false,
      error: 'Project name is required.',
    }
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const validationError = validateGalleryImageFile(imageFile)

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      }
    }
  }

  if (linkedProjectId) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', linkedProjectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (projectError) {
      return {
        ok: false,
        error: projectError.message,
      }
    }

    if (!project) {
      return {
        ok: false,
        error: 'Choose a project you own.',
      }
    }
  } else {
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: newProjectName,
        description: 'Created while adding a unit.',
      })
      .select('id')
      .single()

    if (projectError || !newProject) {
      return {
        ok: false,
        error: projectError?.message || 'Could not create the project.',
      }
    }

    linkedProjectId = newProject.id
    createdProjectId = newProject.id
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .insert({
      user_id: user.id,
      project_id: linkedProjectId,
      name,
      deadline,
      is_active: true,
      is_featured: true,
      status: 'active',
    })
    .select('id')
    .single()

  if (unitError || !unit) {
    return {
      ok: false,
      error: unitError?.message || 'Could not create the unit.',
    }
  }

  if (linkedProjectId) {
    const { error: linkError } = await supabase
      .from('unit_projects')
      .upsert(
        {
          unit_id: unit.id,
          project_id: linkedProjectId,
          user_id: user.id,
        },
        { onConflict: 'unit_id,project_id' }
      )

    if (linkError) {
      console.error('Failed to link projects page unit to project:', linkError)
    }
  }

  if (imageFile instanceof File && imageFile.size > 0) {
    const fileExt = getSafeImageExtension(imageFile.name)
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `units/${unit.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(filePath, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      })

    if (uploadError) {
      return {
        ok: false,
        error: uploadError.message,
      }
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath)

    const { error: imageError } = await supabase.from('image_assets').insert({
      user_id: user.id,
      entity_type: 'unit',
      entity_id: unit.id,
      image_url: data.publicUrl,
      alt_text: name,
      is_featured: true,
      is_primary: true,
      sort_order: 0,
      storage_bucket: IMAGE_BUCKET,
      storage_path: filePath,
    })

    if (imageError) {
      await supabase.storage.from(IMAGE_BUCKET).remove([filePath])
      return {
        ok: false,
        error: imageError.message,
      }
    }
  }

  await completeOnboardingActions({
    userId: user.id,
    subjectProjectId: linkedProjectId,
    subjectUnitId: unit.id,
    actionKeys: [
      'create_unit',
      'name_unit',
      ...(createdProjectId ? ['create_project'] : []),
      ...(linkedProjectId ? ['add_project_unit'] : []),
      'set_unit_status',
      'add_unit_to_active_bench',
      'feature_unit',
    ],
  })

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  if (linkedProjectId) {
    revalidatePath(`/projects/${linkedProjectId}`)
  }
  revalidatePath(`/units/${unit.id}`)

  return {
    ok: true,
    unitId: unit.id,
  }
}
