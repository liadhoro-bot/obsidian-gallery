'use server'

import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'

const IMAGE_BUCKET = 'obsidian-images'

export type CreateOnboardingProjectState = {
  success: boolean
  error: string | null
}

export async function createOnboardingProject(
  previousState: CreateOnboardingProjectState,
  formData: FormData
): Promise<CreateOnboardingProjectState> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      error: 'You must be logged in to create a project.',
    }
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()

  if (!name) {
    return {
      success: false,
      error: 'Project name is required.',
    }
  }

  const { error } = await supabase.from('projects').insert({
    user_id: user.id,
    name,
    description: description || null,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    error: null,
  }
}

export type CreateFirstProjectUnitResult =
  | {
      ok: true
      projectId: string
      unitId: string
    }
  | {
      ok: false
      error: string
    }

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function getFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()

  if (fromName && fromName.length <= 5) {
    return fromName
  }

  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'

  return 'jpg'
}

export async function createFirstProjectUnitAction(
  formData: FormData
): Promise<CreateFirstProjectUnitResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false,
      error: 'You must be logged in to create your first project.',
    }
  }

  const projectName = String(formData.get('projectName') || '').trim()
  const unitName = String(formData.get('unitName') || '').trim()
  const deadline = String(formData.get('deadline') || '').trim()
  const image = formData.get('image')

  if (!projectName || !unitName || !deadline) {
    return {
      ok: false,
      error: 'Project name, unit name, and deadline are required.',
    }
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: projectName,
      description: 'Created during onboarding.',
    })
    .select('id')
    .single()

  if (projectError || !project) {
    console.error('Failed to create onboarding project:', projectError)

    return {
      ok: false,
      error: projectError?.message || 'Could not create your project.',
    }
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .insert({
      user_id: user.id,
      project_id: project.id,
      name: unitName,
      deadline,
      is_featured: true,
    })
    .select('id')
    .single()

  if (unitError || !unit) {
    console.error('Failed to create onboarding unit:', unitError)

    return {
      ok: false,
      error: unitError?.message || 'Could not create your unit.',
    }
  }

await captureServerEvent({
  distinctId: user.id,
  event: 'unit_created',
  properties: {
    unit_id: unit.id,
    unit_name: unitName,
    project_id: project.id,
    has_deadline: Boolean(deadline),
    source: 'onboarding',
  },
})

  if (image instanceof File && image.size > 0) {
    const isAllowedImage =
      image.type === 'image/jpeg' ||
      image.type === 'image/png' ||
      image.type === 'image/webp'

    const maxSize = 8 * 1024 * 1024

    if (isAllowedImage && image.size <= maxSize) {
      const extension = getFileExtension(image)
      const safeProjectName = slugify(projectName) || 'project'
      const safeUnitName = slugify(unitName) || 'unit'

      const storagePath = [
        user.id,
        'onboarding',
        project.id,
        unit.id,
        `${Date.now()}-${safeProjectName}-${safeUnitName}.${extension}`,
      ].join('/')

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(storagePath, image, {
          cacheControl: '3600',
          upsert: false,
          contentType: image.type,
        })

      if (uploadError) {
        console.error('Onboarding image upload failed:', uploadError)
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath)

        const { error: imageAssetError } = await supabase
          .from('image_assets')
          .insert({
            user_id: user.id,
            entity_type: 'unit',
            entity_id: unit.id,
            image_url: publicUrl,
            storage_path: storagePath,
            alt_text: unitName,
            is_featured: true,
            sort_order: 0,
          })

        if (imageAssetError) {
          console.error(
            'Failed to create onboarding image asset:',
            imageAssetError
          )
        }
      }
    }
  }

  return {
    ok: true,
    projectId: project.id,
    unitId: unit.id,
  }
}
export async function acceptTermsAction() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You must be logged in to accept the terms.',
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: '2026-05-13',
    })
    .eq('id', user.id)

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return { ok: true }
}