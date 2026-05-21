'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { updatePaintOwnership } from '../../utils/paint-ownership/update-paint-ownership'
import { captureServerEvent } from '../../utils/analytics/server'

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

  const currentValueRaw = formData.get('currentValue')
  const currentUnitsRaw = formData.get('currentUnits')

  await updatePaintOwnership({
    userId: user.id,
    paintCatalogId: paintId,
    action: 'owned',
    currentValue:
      currentValueRaw === null ? undefined : currentValueRaw === 'true',
    currentUnits:
      currentUnitsRaw === null ? undefined : Number(currentUnitsRaw || 0),
  })

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

  const { data: paint, error } = await supabase
  .from('paints')
  .insert([
    {
      user_id: user.id,
      name,
      manufacturer,
      series,
      paint_type: paintType,
      color_hex: colorHex,
    },
  ])
  .select('id')
  .single()

  if (error) {
    console.error('Error creating custom paint:', error)
    return
  }

await captureServerEvent({
  distinctId: user.id,
  event: 'custom_color_created',
  properties: {
    custom_paint_id: paint?.id || null,
    paint_name: name,
    manufacturer,
    series,
    paint_type: paintType,
    has_color_hex: Boolean(colorHex),
    has_swatch_image: false,
    source: 'vault_actions',
  },
})

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

  const currentValueRaw = formData.get('currentValue')
  const currentUnitsRaw = formData.get('currentUnits')

  await updatePaintOwnership({
    userId: user.id,
    paintCatalogId: paintId,
    action: 'wishlist',
    currentValue:
      currentValueRaw === null ? undefined : currentValueRaw === 'true',
    currentUnits:
      currentUnitsRaw === null ? undefined : Number(currentUnitsRaw || 0),
  })

  revalidatePath('/vault')
  revalidatePath(`/vault/catalog/${paintId}`)
}