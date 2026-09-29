import type { SupabaseClient } from '@supabase/supabase-js'

// Unit and project palettes are both backed by a themes row with an
// open-ended list of theme_paints. The old fixed five-slot model (a
// vestige of V2 themes) is gone: paints are appended, replaced in place,
// or removed by their theme_paints row id.
export type PaletteEdit =
  | { type: 'add'; paintSource: 'catalog' | 'custom'; paintId: string }
  | {
      type: 'replace'
      themePaintId: string
      paintSource: 'catalog' | 'custom'
      paintId: string
    }
  | { type: 'remove'; themePaintId: string }
  | { type: 'reorder'; themePaintIds: string[] }

export type PaletteEditResult = {
  themePaintId: string | null
  // For 'reorder': the rows' ids in their new order. They differ from the
  // ids sent when the rows had to be rewritten (see reorderPalette).
  orderedThemePaintIds?: string[]
}

function paintColumns(paintSource: 'catalog' | 'custom', paintId: string) {
  if (paintSource !== 'catalog' && paintSource !== 'custom') {
    throw new Error('Invalid paint source')
  }

  if (!paintId) {
    throw new Error('Missing paint')
  }

  return {
    paint_source: paintSource,
    paint_catalog_id: paintSource === 'catalog' ? paintId : null,
    custom_paint_id: paintSource === 'custom' ? paintId : null,
  }
}

async function reorderPalette(
  supabase: SupabaseClient,
  themeId: string,
  themePaintIds: string[]
): Promise<PaletteEditResult> {
  const { data: rows, error: rowsError } = await supabase
    .from('theme_paints')
    .select('id, paint_source, paint_catalog_id, custom_paint_id')
    .eq('theme_id', themeId)

  if (rowsError) {
    throw rowsError
  }

  const rowsById = new Map((rows ?? []).map((row) => [row.id as string, row]))
  const isSamePalette =
    themePaintIds.length === rowsById.size &&
    new Set(themePaintIds).size === themePaintIds.length &&
    themePaintIds.every((id) => rowsById.has(id))

  if (!isSamePalette) {
    throw new Error('This palette changed elsewhere. Refresh and try again.')
  }

  const updates = await Promise.all(
    themePaintIds.map((id, index) =>
      supabase
        .from('theme_paints')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('theme_id', themeId)
        .select('id')
    )
  )

  if (updates.every((result) => !result.error && result.data?.length === 1)) {
    return { themePaintId: null, orderedThemePaintIds: themePaintIds }
  }

  // Palette rows have only ever been written with insert/delete; if UPDATE
  // isn't permitted on theme_paints, rewrite the rows in the new order.
  const orderedRows = themePaintIds.map((id, index) => {
    const row = rowsById.get(id)!
    return {
      theme_id: themeId,
      paint_source: row.paint_source,
      paint_catalog_id: row.paint_catalog_id,
      custom_paint_id: row.custom_paint_id,
      sort_order: index,
    }
  })

  const { error: deleteError } = await supabase
    .from('theme_paints')
    .delete()
    .eq('theme_id', themeId)

  if (deleteError) {
    throw deleteError
  }

  const { data: inserted, error: insertError } = await supabase
    .from('theme_paints')
    .insert(orderedRows)
    .select('id, sort_order')

  if (insertError) {
    throw insertError
  }

  return {
    themePaintId: null,
    orderedThemePaintIds: (inserted ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((row) => row.id as string),
  }
}

// Callers must have already verified the current user owns themeId.
export async function applyPaletteEdit(
  supabase: SupabaseClient,
  themeId: string,
  edit: PaletteEdit
): Promise<PaletteEditResult> {
  if (edit.type === 'reorder') {
    return reorderPalette(supabase, themeId, edit.themePaintIds)
  }

  if (edit.type === 'add') {
    const { data: lastPaint, error: lastPaintError } = await supabase
      .from('theme_paints')
      .select('sort_order')
      .eq('theme_id', themeId)
      .order('sort_order', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (lastPaintError) {
      throw lastPaintError
    }

    const { data, error } = await supabase
      .from('theme_paints')
      .insert({
        theme_id: themeId,
        ...paintColumns(edit.paintSource, edit.paintId),
        sort_order: (lastPaint?.sort_order ?? -1) + 1,
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return { themePaintId: data?.id ?? null }
  }

  if (edit.type === 'replace') {
    // Delete + insert at the same position rather than UPDATE: palette
    // writes have always gone through insert/delete, so this stays within
    // the theme_paints permissions already known to work.
    const { data: existing, error: existingError } = await supabase
      .from('theme_paints')
      .select('id, sort_order')
      .eq('id', edit.themePaintId)
      .eq('theme_id', themeId)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (!existing) {
      throw new Error('Palette paint not found')
    }

    const columns = paintColumns(edit.paintSource, edit.paintId)

    const { error: deleteError } = await supabase
      .from('theme_paints')
      .delete()
      .eq('id', existing.id)
      .eq('theme_id', themeId)

    if (deleteError) {
      throw deleteError
    }

    const { data, error } = await supabase
      .from('theme_paints')
      .insert({ theme_id: themeId, ...columns, sort_order: existing.sort_order })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return { themePaintId: data?.id ?? null }
  }

  const { error } = await supabase
    .from('theme_paints')
    .delete()
    .eq('id', edit.themePaintId)
    .eq('theme_id', themeId)

  if (error) {
    throw error
  }

  return { themePaintId: null }
}
