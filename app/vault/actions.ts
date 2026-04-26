'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'

export async function togglePaintOwnership(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const paintId = formData.get('paintId')?.toString()

  if (!paintId) {
    throw new Error('Missing paint id')
  }

  const { data: existing, error: fetchError } = await supabase
    .from('user_paint_ownership')
    .select('id, is_owned, units_owned')
    .eq('user_id', user.id)
    .eq('paint_catalog_id', paintId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (existing) {
    const nextOwned = !existing.is_owned

    const { error } = await supabase
      .from('user_paint_ownership')
      .update({
        is_owned: nextOwned,
        units_owned: nextOwned ? Math.max(existing.units_owned || 1, 1) : 0,
      })
      .eq('id', existing.id)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase.from('user_paint_ownership').insert({
      user_id: user.id,
      paint_catalog_id: paintId,
      is_owned: true,
      units_owned: 1,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath('/vault')
  revalidatePath(`/vault/catalog/${paintId}`)
}

export async function createCustomPaint(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const name = formData.get('name')?.toString().trim()
  const manufacturer = formData.get('manufacturer')?.toString().trim() || null
  const series = formData.get('series')?.toString().trim() || null
  const paintType = formData.get('paintType')?.toString().trim() || null
  const colorHex = formData.get('colorHex')?.toString().trim() || null

  if (!name) return

  const { error } = await supabase.from('paints').insert([
    {
      user_id: user.id,
      name,
      manufacturer,
      series,
      paint_type: paintType,
      color_hex: colorHex,
    },
  ])

  if (error) {
    console.error('Error creating custom paint:', error)
    return
  }

  revalidatePath('/vault')
}
export async function togglePaintWishlist(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const paintId = formData.get('paintId')?.toString()

  if (!paintId) {
    throw new Error('Missing paint id')
  }

  const { data: existing } = await supabase
    .from('user_paint_ownership')
    .select('id, is_wishlist')
    .eq('user_id', user.id)
    .eq('paint_catalog_id', paintId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('user_paint_ownership')
      .update({
        is_wishlist: !existing.is_wishlist,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('user_paint_ownership').insert({
      user_id: user.id,
      paint_catalog_id: paintId,
      is_owned: false,
      is_wishlist: true,
    })
  }

  revalidatePath('/vault')
}