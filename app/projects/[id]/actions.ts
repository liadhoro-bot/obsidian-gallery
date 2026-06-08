'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { redirect } from 'next/navigation'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  extractPaletteFromImage,
  findNearestUniquePaints,
} from '../../../utils/color-matching'

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

  await supabase
    .from('image_assets')
    .delete()
    .eq('entity_id', projectId)
    .eq('entity_type', 'project')

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

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  revalidatePath('/dashboard')

  if (themeId) {
    revalidatePath(`/themes/${themeId}`)
  }
}

export async function setProjectPaletteSlot(
  projectId: string,
  slotIndex: number,
  paintSource: 'catalog' | 'custom',
  paintId: string
) {
  const supabase = await createClient()

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

  let themeId = project.theme_id

  if (!themeId) {
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
      console.error(themeError)
      return
    }

    themeId = newTheme.id

    await supabase
      .from('projects')
      .update({ theme_id: themeId })
      .eq('id', projectId)
      .eq('user_id', user.id)
  }

  const sortOrder = slotIndex + 1

  await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)
    .eq('sort_order', sortOrder)

  await supabase.from('theme_paints').insert({
    theme_id: themeId,
    paint_source: paintSource,
    paint_catalog_id: paintSource === 'catalog' ? paintId : null,
    custom_paint_id: paintSource === 'custom' ? paintId : null,
    sort_order: sortOrder,
  })

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/themes/${themeId}`)
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
  await supabase.from('theme_paints').insert(paintRows)
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
