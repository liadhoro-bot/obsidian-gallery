'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'
import { createPerfTimer } from '../../utils/perf/server'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../utils/images/gallery-upload'
import {
  completeOnboardingActions,
  reconcileOnboardingFlowStart,
} from '../../lib/onboarding/completion'
import type { OnboardingFlowName } from '../../lib/onboarding/action-definitions'

const IMAGE_BUCKET = 'obsidian-images'

export type OnboardingGoal =
  | 'paint_miniature'
  | 'organize_hobby'
  | 'create_content'
  | 'look_around'

export type OnboardingExperience =
  | 'just_starting'
  | 'know_basics'
  | 'experienced'
  | 'professional'

const goalFlowMap: Record<OnboardingGoal, OnboardingFlowName | null> = {
  paint_miniature: 'paint_miniature',
  organize_hobby: 'organize_hobby',
  create_content: 'create_content',
  look_around: null,
}

export async function saveOnboardingGoalAction(
  goal: OnboardingGoal,
  experienceLevel: OnboardingExperience | null
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You must be logged in to save onboarding preferences.',
    }
  }

  const flowName = goalFlowMap[goal]
  const now = new Date().toISOString()
  const { error } = await supabase.from('user_onboarding_flows').upsert(
    {
      user_id: user.id,
      goal_key: goal,
      flow_name: flowName,
      experience_level: experienceLevel,
      started_at: now,
      completed_at: null,
      dismissed_at: flowName ? null : now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  const { error: completionError } = await supabase
    .from('user_onboarding_action_completions')
    .delete()
    .eq('user_id', user.id)

  if (completionError) {
    return {
      ok: false,
      error: completionError.message,
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: flowName ? 'onboarding_flow_started' : 'onboarding_flow_dismissed',
    properties: {
      flow_name: flowName,
      goal_key: goal,
      experience_level: experienceLevel,
    },
  })

  await reconcileOnboardingFlowStart({
    userId: user.id,
    flowName,
  })

  return { ok: true }
}

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
  const perf = createPerfTimer('action:createFirstProjectUnit')
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (userError || !user) {
    return {
      ok: false,
      error: 'You must be logged in to create your first project.',
    }
  }

  const rawProjectName = String(formData.get('projectName') || '').trim()
  const unitName = String(formData.get('unitName') || '').trim()
  const deadline = String(formData.get('deadline') || '').trim() || null
  const image = formData.get('image')

  if (!unitName) {
    return {
      ok: false,
      error: 'Miniature name is required.',
    }
  }

  const projectName = rawProjectName || 'Onboarding Bench'

  let persistedUnitImage = false

  if (image instanceof File && image.size > 0) {
    const validationError = validateGalleryImageFile(image)

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      }
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
  perf.mark('project Supabase mutation')

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .insert({
      user_id: user.id,
      project_id: project.id,
      name: unitName,
      deadline,
      is_active: true,
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
  perf.mark('unit Supabase mutation')

  const { error: unitProjectsError } = await supabase
    .from('unit_projects')
    .insert({
      unit_id: unit.id,
      project_id: project.id,
      user_id: user.id,
    })

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
      project_id: project.id,
      has_deadline: Boolean(deadline),
      source: 'onboarding',
    },
  })
  perf.mark('analytics event')

  if (image instanceof File && image.size > 0) {
    const isAllowedImage =
      image.type === 'image/jpeg' ||
      image.type === 'image/png' ||
      image.type === 'image/webp'

    const maxSize = 8 * 1024 * 1024

    if (isAllowedImage && image.size <= maxSize) {
      const extension = getSafeImageExtension(image.name || getFileExtension(image))
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
        perf.mark('image upload flow')
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
            is_primary: true,
            sort_order: 0,
            storage_bucket: IMAGE_BUCKET,
          })

        if (imageAssetError) {
          console.error(
            'Failed to create onboarding image asset:',
            imageAssetError
          )
        } else {
          persistedUnitImage = true
        }
        perf.mark('image/gallery queries')
      }
    }
  }

  await completeOnboardingActions({
    userId: user.id,
    subjectProjectId: project.id,
    subjectUnitId: unit.id,
    actionKeys: [
      'create_unit',
      'name_unit',
      ...(persistedUnitImage ? ['add_unit_image'] : []),
      'create_project',
      'add_project_unit',
      'feature_unit',
    ],
  })

  perf.total()
  revalidatePath('/dashboard')
  revalidatePath('/projects')
  revalidatePath(`/projects/${project.id}`)
  revalidatePath(`/units/${unit.id}`)

  return {
    ok: true,
    projectId: project.id,
    unitId: unit.id,
  }
}

export type CreateOnboardingGuideResult =
  | {
      ok: true
      guideId: string
    }
  | {
      ok: false
      error: string
    }

export async function createOnboardingGuideAction(
  formData: FormData
): Promise<CreateOnboardingGuideResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: 'You must be logged in to create a guide.',
    }
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const coverImage = formData.get('coverImage')

  if (!name) {
    return {
      ok: false,
      error: 'Guide name is required.',
    }
  }

  if (coverImage instanceof File && coverImage.size > 0) {
    const validationError = validateGalleryImageFile(coverImage)

    if (validationError) {
      return {
        ok: false,
        error: validationError,
      }
    }
  }

  let imageUrl: string | null = null
  let storagePath: string | null = null

  if (coverImage instanceof File && coverImage.size > 0) {
    const fileExt = getSafeImageExtension(coverImage.name)
    storagePath = `recipe-covers/${user.id}/onboarding-${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(storagePath, coverImage, {
        contentType: coverImage.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      return {
        ok: false,
        error: uploadError.message,
      }
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath)
    imageUrl = data.publicUrl
  }

  const { data: guide, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      image_url: imageUrl,
      is_public: false,
    })
    .select('id, name, description, image_url, is_public')
    .single()

  if (error || !guide) {
    if (storagePath) {
      await supabase.storage.from(IMAGE_BUCKET).remove([storagePath])
    }

    return {
      ok: false,
      error: error?.message || 'Could not create guide.',
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_created',
    properties: {
      recipe_id: guide.id,
      recipe_name: guide.name,
      is_public: guide.is_public,
      has_description: Boolean(guide.description),
      has_image: Boolean(guide.image_url),
      source: 'onboarding',
    },
  })

  await completeOnboardingActions({
    userId: user.id,
    subjectGuideId: guide.id,
    actionKeys: [
      'choose_guide_source',
      'create_guide',
      'name_guide',
      ...(imageUrl ? ['add_guide_cover'] : []),
    ],
  })

  revalidatePath('/dashboard')
  revalidatePath('/recipes')
  revalidatePath(`/recipes/${guide.id}`)

  return {
    ok: true,
    guideId: guide.id,
  }
}
const TERMS_VERSION = '2026-05-13'
const TERMS_ACCEPTANCE_TABLE = 'user_terms_acceptances'

function isMissingSchemaObjectError(error: { code?: string; message?: string }) {
  const message = error.message ?? ''

  return (
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    /schema cache/i.test(message) ||
    /could not find/i.test(message) ||
    /does not exist/i.test(message)
  )
}

export async function acceptTermsAction({
  productUpdatesApproved = false,
}: {
  productUpdatesApproved?: boolean
} = {}) {
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

  const acceptedAt = new Date().toISOString()
  const productUpdatesApprovedAt = productUpdatesApproved ? acceptedAt : null

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      terms_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
    })
    .eq('id', user.id)

  if (profileError && !isMissingSchemaObjectError(profileError)) {
    return {
      ok: false,
      error: profileError.message,
    }
  }

  if (profileError) {
    const { error: fallbackProfileError } = await supabase
      .from('profiles')
      .update({
        terms_accepted_at: acceptedAt,
      })
      .eq('id', user.id)

    if (fallbackProfileError) {
      return {
        ok: false,
        error: fallbackProfileError.message,
      }
    }
  }

  const { error: acceptanceError } = await supabase
    .from(TERMS_ACCEPTANCE_TABLE)
    .insert({
      user_id: user.id,
      terms_version: TERMS_VERSION,
      accepted_at: acceptedAt,
      product_updates_approved_at: productUpdatesApprovedAt,
    })

  if (acceptanceError && !isMissingSchemaObjectError(acceptanceError)) {
    console.error('Failed to record terms acceptance audit row:', acceptanceError)
  }

  return { ok: true }
}
