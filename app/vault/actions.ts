'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { updatePaintOwnership } from '../../utils/paint-ownership/update-paint-ownership'
import { captureServerEvent } from '../../utils/analytics/server'

function isMissingCustomPaintMigrationError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: string; message?: string }
  const message = candidate.message || ''

  return (
    candidate.code === 'PGRST204' ||
    message.includes("Could not find the 'description' column") ||
    message.includes('schema cache')
  )
}

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
  const description = formData.get('description')?.toString().trim() || null

  if (!name) return

  const { data: paint, error } = await supabase
  .from('paints')
  .insert([
    {
      user_id: user.id,
      name,
      manufacturer,
      series,
      description,
      paint_type: paintType,
      color_hex: colorHex,
    },
  ])
  .select('id')
  .single()

  if (error) {
    if (isMissingCustomPaintMigrationError(error)) {
      throw new Error(
        'The custom paint mix database migration has not been applied yet. Run supabase/migrations/20260717120000_add_custom_paint_mix_details.sql, then reload the app.'
      )
    }

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
    has_description: Boolean(description),
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
