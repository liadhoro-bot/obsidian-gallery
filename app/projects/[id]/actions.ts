'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  extractPaletteFromImage,
  findNearestUniquePaints,
} from '../../../utils/color-matching'
import { completeOnboardingAction } from '../../../lib/onboarding/completion'
import { applyPaletteEdit, type PaletteEdit } from '../../../lib/palette/palette-edit'

type StoredImageAsset = {
  storage_bucket: string | null
  storage_path: string | null
}

async function removeStoredImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  images: StoredImageAsset[]
) {
  const pathsByBucket = images.reduce<Record<string, string[]>>((acc, image) => {
    if (image.storage_bucket && image.storage_path) {
      acc[image.storage_bucket] = acc[image.storage_bucket] || []
      acc[image.storage_bucket].push(image.storage_path)
    }

    return acc
  }, {})

  for (const [bucket, paths] of Object.entries(pathsByBucket)) {
    const { error } = await supabase.storage.from(bucket).remove(paths)

    if (error) {
      throw error
    }
  }
}

export async function setFeaturedUnit(formData: FormData) {
  const supabase = await createClient()

  const unitId = formData.get('unitId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!unitId || !projectId) {
    return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { data: unit } = await supabase
    .from('units')
    .select('id, project_id')
    .eq('id', unitId)
    .eq('user_id', user.id)
    .single()

  if (!unit) {
    return
  }

  if (unit.project_id !== projectId) {
    return
  }

  await supabase
    .from('units')
    .update({ is_featured: false })
    .eq('project_id', unit.project_id)
    .eq('user_id', user.id)

  await supabase
    .from('units')
    .update({ is_featured: true })
    .eq('id', unitId)
    .eq('user_id', user.id)

  await captureServerEvent({
    distinctId: user.id,
    event: 'project_featured_unit_set',
    properties: {
      project_id: projectId,
      unit_id: unitId,
    },
  })

  revalidatePath(`/projects/${projectId}`)
}
export async function deleteProject(formData: FormData) {
  const supabase = await createClient()

  const projectId = formData.get('projectId')?.toString()

  if (!projectId) {
    return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    return
  }

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  if (unitsError) {
    throw unitsError
  }

  const unitIds = (units ?? [])
    .map((unit) => unit.id)
    .filter((unitId): unitId is string => Boolean(unitId))

  const [projectImagesResult, unitImagesResult] = await Promise.all([
    supabase
      .from('image_assets')
      .select('storage_bucket, storage_path')
      .eq('entity_id', projectId)
      .eq('entity_type', 'project')
      .eq('user_id', user.id),
    unitIds.length > 0
      ? supabase
          .from('image_assets')
          .select('storage_bucket, storage_path')
          .eq('entity_type', 'unit')
          .eq('user_id', user.id)
          .in('entity_id', unitIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (projectImagesResult.error) {
    throw projectImagesResult.error
  }

  if (unitImagesResult.error) {
    throw unitImagesResult.error
  }

  await removeStoredImages(supabase, [
    ...((projectImagesResult.data ?? []) as StoredImageAsset[]),
    ...((unitImagesResult.data ?? []) as StoredImageAsset[]),
  ])

  if (unitIds.length > 0) {
    await supabase
      .from('unit_stage_paints')
      .delete()
      .in('unit_id', unitIds)
      .eq('user_id', user.id)

    await supabase
      .from('unit_stage_recipes')
      .delete()
      .in('unit_id', unitIds)
      .eq('user_id', user.id)

    await supabase
      .from('unit_sessions')
      .delete()
      .in('unit_id', unitIds)
      .eq('user_id', user.id)

    await supabase
      .from('unit_progress_steps')
      .delete()
      .in('unit_id', unitIds)

    await supabase
      .from('unit_stage_progress')
      .delete()
      .in('unit_id', unitIds)

    await supabase
      .from('image_assets')
      .delete()
      .eq('entity_type', 'unit')
      .eq('user_id', user.id)
      .in('entity_id', unitIds)
  }

  await supabase
    .from('image_assets')
    .delete()
    .eq('entity_id', projectId)
    .eq('entity_type', 'project')
    .eq('user_id', user.id)

  await supabase
    .from('unit_projects')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  await supabase
    .from('units')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)

  await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  await captureServerEvent({
    distinctId: user.id,
    event: 'project_deleted',
    properties: {
      project_id: projectId,
      unit_count: unitIds.length,
    },
  })

  revalidatePath('/projects')

  redirect('/projects')
}

export async function unassignProjectTheme(formData: FormData) {
  const supabase = await createClient()

  const projectId = String(formData.get('projectId') || '')
  const themeId = String(formData.get('themeId') || '')

  if (!projectId) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const { error } = await supabase
    .from('projects')
    .update({ theme_id: null })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'project_theme_unassigned',
    properties: {
      project_id: projectId,
      theme_id: themeId || null,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')

  if (themeId) {
    revalidatePath(`/themes/${themeId}`)
  }
}

export async function editProjectPalette(projectId: string, edit: PaletteEdit) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, theme_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    throw new Error('Project not found')
  }

  let themeId: string | null = project.theme_id

  if (themeId) {
    // theme_id can point at a public theme assigned back in the V2 themes
    // era - never edit someone else's theme through this card.
    const { data: ownedTheme } = await supabase
      .from('themes')
      .select('id')
      .eq('id', themeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ownedTheme) {
      if (edit.type !== 'add') {
        throw new Error('This palette belongs to a shared theme and cannot be edited here.')
      }
      themeId = null
    }
  }

  if (!themeId) {
    if (edit.type !== 'add') {
      throw new Error('Palette not found')
    }

    const { data: newTheme, error: themeError } = await supabase
      .from('themes')
      .insert({
        user_id: user.id,
        name: `${project.name || 'Project'} Palette`,
        description: 'Project palette created from the project page.',
        is_public: false,
      })
      .select('id')
      .single()

    if (themeError || !newTheme) {
      throw themeError || new Error('Failed to create project palette')
    }

    themeId = newTheme.id as string

    const { error: assignError } = await supabase
      .from('projects')
      .update({ theme_id: themeId })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (assignError) {
      throw assignError
    }
  }

  const result = await applyPaletteEdit(supabase, themeId, edit)

  if (edit.type === 'add' || edit.type === 'replace') {
    await completeOnboardingAction({
      userId: user.id,
      actionKey: 'create_project_palette',
      subjectProjectId: projectId,
    })
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'palette_paint_edited',
    properties: {
      source_type: 'project',
      project_id: projectId,
      theme_id: themeId,
      edit_type: edit.type,
      paint_source: 'paintSource' in edit ? edit.paintSource : null,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/themes/${themeId}`)

  return result
}

export async function setProjectFeatured(projectId: string, featured: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) {
    throw new Error('Project not found')
  }

  // The dashboard hero shows one featured thing, so clear any other
  // featured project (and, below, any featured unit) first.
  const { error: clearError } = await supabase
    .from('projects')
    .update({ is_featured: false })
    .eq('user_id', user.id)
    .eq('is_featured', true)

  if (clearError) {
    console.error('Error clearing featured project:', clearError)
    throw new Error(
      'Featuring projects needs the latest database migration (projects.is_featured).'
    )
  }

  if (featured) {
    const { error: setError } = await supabase
      .from('projects')
      .update({ is_featured: true })
      .eq('id', projectId)
      .eq('user_id', user.id)

    if (setError) {
      throw setError
    }

    const { error: clearUnitsError } = await supabase
      .from('units')
      .update({ is_featured: false })
      .eq('user_id', user.id)
      .eq('is_featured', true)

    if (clearUnitsError) {
      throw clearUnitsError
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: featured ? 'project_featured' : 'project_unfeatured',
    properties: {
      project_id: projectId,
    },
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}

export async function calculateProjectPaletteAction(formData: FormData) {
  const supabase = await createClient()

  const projectId = String(formData.get('projectId') || '')

  if (!projectId) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, theme_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) return

  const { data: featuredImage } = await supabase
    .from('image_assets')
    .select('image_url')
    .eq('entity_type', 'project')
    .eq('entity_id', projectId)
    .eq('is_featured', true)
    .maybeSingle()

  if (!featuredImage?.image_url) return

  let themeId = project.theme_id

  if (!themeId) {
    const { data: newTheme, error: themeError } = await supabase
      .from('themes')
      .insert({
        user_id: user.id,
        name: `${project.name || 'Project'} Palette`,
        description: 'Project palette created from the project image.',
        image_url: featuredImage.image_url,
        is_public: false,
      })
      .select('id')
      .single()

    if (themeError || !newTheme) return

    themeId = newTheme.id

    await supabase
      .from('projects')
      .update({ theme_id: themeId })
      .eq('id', projectId)
      .eq('user_id', user.id)
  }

  const extractedHexes = await extractPaletteFromImage(featuredImage.image_url)

  const { data: catalogColors } = await supabase
    .from('paint_catalog')
    .select('id, hex_approx, color_match_enabled')
    .eq('is_active', true)
    .eq('color_match_enabled', true)
    .not('hex_approx', 'is', null)
    .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')
    .limit(5000)

  if (!catalogColors?.length) return

  const paintRows = findNearestUniquePaints(extractedHexes, catalogColors)
    .map((nearestPaint, index) => ({
      theme_id: themeId,
      paint_source: 'catalog',
      paint_catalog_id: nearestPaint.id,
      custom_paint_id: null,
      sort_order: index,
    }))

  await supabase.from('theme_paints').delete().eq('theme_id', themeId)

if (paintRows.length > 0) {
  const { error: insertError } = await supabase.from('theme_paints').insert(paintRows)

  if (insertError) {
    throw insertError
  }

  await completeOnboardingAction({
    userId: user.id,
    actionKey: 'create_project_palette',
    subjectProjectId: projectId,
  })
}

await captureServerEvent({
  distinctId: user.id,
  event: 'palette_calculator_used',
  properties: {
    source_type: 'project',
    source_id: projectId,
    project_id: projectId,
    theme_id: themeId,
    extracted_colors_count: extractedHexes.length,
    matched_paints_count: paintRows.length,
  },
})

revalidatePath(`/projects/${projectId}`)
revalidatePath(`/themes/${themeId}`)
}
