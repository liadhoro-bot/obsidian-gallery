'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import {
  extractPaletteFromImage,
  findNearestPaint,
} from './palette-utils'

export async function toggleThemeVisibility(themeId: string, nextValue: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('themes')
    .update({
      is_public: nextValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', themeId)
    .eq('user_id', user.id)

  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
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

  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
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

  revalidatePath(`/themes/${themeId}`)
}
export async function searchThemePaints(query: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const q = query.trim()

  const baseSelect =
    'id, name, brand, line, sku, swatch_image_url, hex_approx'

  let catalogPaints: any[] = []

  if (!q) {
    const { data } = await supabase
      .from('paint_catalog')
      .select(baseSelect)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(120)

    catalogPaints = data || []
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

    const merged = searches.flatMap((result) => result.data || [])
    const unique = new Map<string, any>()

    for (const paint of merged) {
      unique.set(paint.id, paint)
    }

    catalogPaints = Array.from(unique.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    )
  }

  let customPaints: any[] = []

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

    customPaints = data || []
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
    .select('id, hex_approx')
    .eq('is_active', true)
    .not('hex_approx', 'is', null)

  const matchedPaints = extractedHexes
    .map((hex) => findNearestPaint(hex, catalogColors || []))
    .filter(Boolean)
    .slice(0, 5)

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

  revalidatePath('/themes')
  revalidatePath(`/themes/${themeId}`)
}