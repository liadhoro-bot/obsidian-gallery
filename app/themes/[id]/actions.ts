'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { captureServerEvent } from '../../../utils/analytics/server'
import {
  extractPaletteFromImage,
  findNearestUniquePaints,
} from '../../../utils/color-matching'
import { createPerfTimer } from '../../../utils/perf/server'

function revalidateThemeCaches(themeId: string) {
  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
  revalidateTag('public-themes', 'max')
  revalidateTag(`theme:${themeId}`, 'max')
}

const unitThemeMarker = (unitId: string) => `[unit:${unitId}]`

function appendUnitThemeMarkers(description: string | null, unitIds: string[]) {
  const current = description?.trim() ?? ''
  const missingMarkers = unitIds
    .map((unitId) => unitThemeMarker(unitId))
    .filter((marker) => !current.includes(marker))

  if (missingMarkers.length === 0) return current

  return [current, ...missingMarkers].filter(Boolean).join('\n\n')
}

function removeUnitThemeMarkers(description: string | null, unitIds: string[]) {
  return unitIds
    .reduce(
      (current, unitId) =>
        current
          .replace(new RegExp(`\\n\\n\\[unit:${unitId}\\]`, 'g'), '')
          .replace(new RegExp(`\\[unit:${unitId}\\]`, 'g'), ''),
      description || ''
    )
    .trim()
}

async function canAssignTheme(
  supabase: Awaited<ReturnType<typeof createClient>>,
  themeId: string,
  userId: string
) {
  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, user_id, is_public')
    .eq('id', themeId)
    .maybeSingle()

  if (themeError) throw themeError

  if (!theme) return false

  if (theme.user_id === userId || theme.is_public) return true

  const { data: savedTheme, error: savedThemeError } = await supabase
    .from('saved_themes')
    .select('theme_id')
    .eq('theme_id', themeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (savedThemeError) throw savedThemeError

  return Boolean(savedTheme)
}

export async function toggleThemeVisibility(themeId: string, nextValue: boolean) {
  const perf = createPerfTimer('action:toggleThemeVisibility')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) {
    perf.total()
    return
  }

  const { error } = await supabase
    .from('themes')
    .update({
      is_public: nextValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', themeId)
    .eq('user_id', user.id)

  if (error) throw error
  perf.mark('Supabase mutation')

  revalidateThemeCaches(themeId)
  perf.mark('revalidation duration')
  perf.total()
}

export async function assignThemeToProjects(formData: FormData) {
  const supabase = await createClient()

  const themeId = String(formData.get('themeId') || '')
  const projectIds = formData
    .getAll('projectIds')
    .map((value) => String(value))
    .filter(Boolean)

  if (!themeId || projectIds.length === 0) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const canAssign = await canAssignTheme(supabase, themeId, user.id)

  if (!canAssign) return

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .in('id', projectIds)

  if (projectsError) throw projectsError

  const allowedProjectIds = (projects ?? []).map((project) => project.id)

  if (allowedProjectIds.length === 0) return

  const { error: updateError } = await supabase
    .from('projects')
    .update({ theme_id: themeId })
    .eq('user_id', user.id)
    .in('id', allowedProjectIds)

  if (updateError) throw updateError

  for (const projectId of allowedProjectIds) {
    revalidatePath(`/projects/${projectId}`)
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidateThemeCaches(themeId)
}

export async function assignThemeToUnits(formData: FormData) {
  const supabase = await createClient()

  const themeId = String(formData.get('themeId') || '')
  const unitIds = formData
    .getAll('unitIds')
    .map((value) => String(value))
    .filter(Boolean)

  if (!themeId || unitIds.length === 0) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const canAssign = await canAssignTheme(supabase, themeId, user.id)

  if (!canAssign) return

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, user_id, description')
    .eq('id', themeId)
    .maybeSingle()

  if (themeError) throw themeError
  if (!theme) return

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .eq('user_id', user.id)
    .in('id', unitIds)

  if (unitsError) throw unitsError

  const allowedUnitIds = (units ?? []).map((unit) => unit.id)

  if (allowedUnitIds.length === 0) return

  const { error: themeColumnError } = await supabase
    .from('units')
    .select('theme_id')
    .eq('user_id', user.id)
    .limit(1)

  if (!themeColumnError) {
    const { error: updateUnitsError } = await supabase
      .from('units')
      .update({ theme_id: themeId })
      .eq('user_id', user.id)
      .in('id', allowedUnitIds)

    if (updateUnitsError) throw updateUnitsError
  } else {
    if (theme.user_id !== user.id) {
      throw new Error('Apply the unit palette migration before assigning this theme to a unit')
    }

    const { data: markedThemes, error: markedThemesError } = await supabase
      .from('themes')
      .select('id, description')
      .eq('user_id', user.id)

    if (markedThemesError) throw markedThemesError

    for (const markedTheme of markedThemes ?? []) {
      if (
        !markedTheme.description ||
        !allowedUnitIds.some((unitId) =>
          markedTheme.description?.includes(unitThemeMarker(unitId))
        )
      ) {
        continue
      }

      const { error: clearMarkerError } = await supabase
        .from('themes')
        .update({
          description: removeUnitThemeMarkers(
            markedTheme.description,
            allowedUnitIds
          ),
        })
        .eq('id', markedTheme.id)
        .eq('user_id', user.id)

      if (clearMarkerError) throw clearMarkerError
    }

    const { error: updateThemeError } = await supabase
      .from('themes')
      .update({
        description: appendUnitThemeMarkers(theme.description, allowedUnitIds),
      })
      .eq('id', themeId)
      .eq('user_id', user.id)

    if (updateThemeError) throw updateThemeError
  }

  for (const unitId of allowedUnitIds) {
    revalidatePath(`/units/${unitId}`)
  }

  revalidatePath('/dashboard')
  revalidateThemeCaches(themeId)
}

export async function updateTheme(themeId: string, formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const tagsInput = String(formData.get('tags') || '').trim()
  const imageFile = formData.get('image') as File | null

  if (!name) return

  const tags = tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  let imageUrl: string | null = null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop() || 'jpg'
    const filePath = `themes/${themeId}/hero.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, imageFile, {
        upsert: true,
        contentType: imageFile.type,
      })

    if (!uploadError) {
      const { data } = supabase.storage
        .from('obsidian-images')
        .getPublicUrl(filePath)

      imageUrl = data.publicUrl
    }
  }

  await supabase
    .from('themes')
    .update({
      name,
      description,
      tags,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', themeId)
    .eq('user_id', user.id)

  revalidateThemeCaches(themeId)
}

export async function deleteTheme(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const themeId = String(formData.get('themeId') || '')

  if (!themeId) return

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id')
    .eq('id', themeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (themeError) {
    throw themeError
  }

  if (!theme) {
    return
  }

  await supabase
    .from('projects')
    .update({ theme_id: null })
    .eq('theme_id', themeId)
    .eq('user_id', user.id)

  await supabase
    .from('saved_themes')
    .delete()
    .eq('theme_id', themeId)

  await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)

  await supabase
    .from('themes')
    .delete()
    .eq('id', themeId)
    .eq('user_id', user.id)

  revalidatePath('/themes')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidateTag('public-themes', 'max')
  revalidateTag(`theme:${themeId}`, 'max')

  redirect('/themes')
}
export async function setThemePaintSlot(
  themeId: string,
  slotIndex: number,
  paintSource: 'catalog' | 'custom',
  paintId: string
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const sortOrder = slotIndex + 1

  const { data: theme } = await supabase
    .from('themes')
    .select('id')
    .eq('id', themeId)
    .eq('user_id', user.id)
    .single()

  if (!theme) return

  await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)
    .eq('sort_order', sortOrder)

  await supabase.from('theme_paints').insert({
    theme_id: themeId,
    sort_order: sortOrder,
    paint_source: paintSource,
    paint_catalog_id: paintSource === 'catalog' ? paintId : null,
    custom_paint_id: paintSource === 'custom' ? paintId : null,
  })

  revalidateThemeCaches(themeId)
}
export async function searchThemePaints(query: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const q = query.trim()

  const baseSelect =
    'id, name, brand, line, sku, swatch_image_url, hex_approx'

  type CatalogPaintSearchRow = {
    id: string
    name: string | null
    brand: string | null
    line: string | null
    sku?: string | null
    swatch_image_url: string | null
    hex_approx: string | null
  }

  type CustomPaintSearchRow = {
    id: string
    name: string | null
    manufacturer: string | null
    series: string | null
    color_hex: string | null
  }

  let catalogPaints: CatalogPaintSearchRow[] = []

  if (!q) {
    const { data } = await supabase
      .from('paint_catalog')
      .select(baseSelect)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(120)

    catalogPaints = (data || []) as CatalogPaintSearchRow[]
  } else {
    const searches = await Promise.all([
      supabase
        .from('paint_catalog')
        .select(baseSelect)
        .eq('is_active', true)
        .ilike('name', `%${q}%`)
        .limit(80),

      supabase
        .from('paint_catalog')
        .select(baseSelect)
        .eq('is_active', true)
        .ilike('brand', `%${q}%`)
        .limit(80),

      supabase
        .from('paint_catalog')
        .select(baseSelect)
        .eq('is_active', true)
        .ilike('line', `%${q}%`)
        .limit(80),

      supabase
        .from('paint_catalog')
        .select(baseSelect)
        .eq('is_active', true)
        .ilike('sku', `%${q}%`)
        .limit(80),
    ])

    const merged = searches.flatMap(
      (result) => (result.data || []) as CatalogPaintSearchRow[]
    )
    const unique = new Map<string, CatalogPaintSearchRow>()

    for (const paint of merged) {
      unique.set(paint.id, paint)
    }

    catalogPaints = Array.from(unique.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    )
  }

  let customPaints: CustomPaintSearchRow[] = []

  if (user) {
    const customQuery = supabase
      .from('paints')
      .select('id, name, manufacturer, series, color_hex')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .limit(80)

    const { data } = q
      ? await customQuery.ilike('name', `%${q}%`)
      : await customQuery

    customPaints = (data || []) as CustomPaintSearchRow[]
  }

  return [
    ...catalogPaints.map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.brand,
      line: paint.line,
      swatch_image_url: paint.swatch_image_url,
      hex: paint.hex_approx,
    })),

    ...customPaints.map((paint) => ({
      id: paint.id,
      source: 'custom' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.manufacturer,
      line: paint.series,
      swatch_image_url: null,
      hex: paint.color_hex,
    })),
  ]
}
export async function calculateThemePaletteAction(formData: FormData) {
  const themeId = String(formData.get('themeId') || '')

  if (!themeId) {
    throw new Error('Missing theme id')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, image_url, user_id')
    .eq('id', themeId)
    .eq('user_id', user.id)
    .single()

  if (themeError || !theme) {
    throw new Error('Theme not found')
  }

  if (!theme.image_url) {
    throw new Error('Theme has no hero image')
  }

  const extractedHexes = await extractPaletteFromImage(theme.image_url)

  const { data: catalogColors } = await supabase
    .from('paint_catalog')
    .select('id, hex_approx, color_match_enabled')
    .eq('is_active', true)
    .eq('color_match_enabled', true)
    .not('hex_approx', 'is', null)
    .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')

  const matchedPaints = findNearestUniquePaints(extractedHexes, catalogColors || [])

  await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)

  await supabase.from('theme_paints').insert(
    matchedPaints.map((paint, index) => ({
      theme_id: themeId,
      sort_order: index + 1,
      paint_source: 'catalog',
      paint_catalog_id: paint.id,
      custom_paint_id: null,
    }))
  )

await captureServerEvent({
  distinctId: user.id,
  event: 'palette_calculator_used',
  properties: {
    source_type: 'theme',
    source_id: themeId,
    theme_id: themeId,
    extracted_colors_count: extractedHexes.length,
    matched_paints_count: matchedPaints.length,
  },
})

  revalidateThemeCaches(themeId)
}

