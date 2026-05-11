'use server'

import { createClient } from '../supabase/server'
import { captureServerEvent } from '../analytics/server'

type OwnershipAction =
  | 'owned'
  | 'wishlist'
  | 'increment'
  | 'decrement'

type Args = {
  userId: string
  paintCatalogId: string
  action: OwnershipAction
  currentValue?: boolean
  currentUnits?: number
}

export async function updatePaintOwnership({
  userId,
  paintCatalogId,
  action,
  currentValue,
  currentUnits = 0,
}: Args) {
  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('user_paint_ownership')
    .select('is_owned, is_wishlist, units_owned')
    .eq('user_id', userId)
    .eq('paint_catalog_id', paintCatalogId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  const previousOwned = existing?.is_owned ?? false
  const previousWishlist = existing?.is_wishlist ?? false
  const previousUnits = existing?.units_owned ?? currentUnits ?? 0

  let nextOwned = previousOwned
  let nextWishlist = previousWishlist
  let nextUnits = previousUnits

  if (action === 'owned') {
    nextOwned = !(currentValue ?? previousOwned)
    nextUnits = nextOwned
      ? Math.max(previousUnits || 1, 1)
      : 0
  }

  if (action === 'wishlist') {
    nextWishlist = !(currentValue ?? previousWishlist)
  }

  if (action === 'increment') {
    nextUnits = previousUnits + 1
    nextOwned = true
  }

  if (action === 'decrement') {
    nextUnits = Math.max(previousUnits - 1, 0)
    nextOwned = nextUnits > 0
  }

  const { data: updated, error: upsertError } = await supabase
    .from('user_paint_ownership')
    .upsert(
      {
        user_id: userId,
        paint_catalog_id: paintCatalogId,
        is_owned: nextOwned,
        is_wishlist: nextWishlist,
        units_owned: nextUnits,
      },
      {
        onConflict: 'user_id,paint_catalog_id',
      }
    )
    .select('is_owned, is_wishlist, units_owned')
    .single()

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  const { data: paint } = await supabase
    .from('paint_catalog')
    .select(`
      id,
      name,
      brand,
      line,
      sku,
      paint_type,
      finish
    `)
    .eq('id', paintCatalogId)
    .single()

  await captureServerEvent({
    distinctId: userId,
    event: 'paint_ownership_updated',
    properties: {
      paint_source: 'catalog',
      paint_id: paintCatalogId,
      paint_name: paint?.name ?? null,
      brand: paint?.brand ?? null,
      line: paint?.line ?? null,
      sku: paint?.sku ?? null,
      paint_type: paint?.paint_type ?? null,
      finish: paint?.finish ?? null,
      action,
      is_owned: updated.is_owned,
      is_wishlist: updated.is_wishlist,
      units_owned: updated.units_owned,
    },
  })

  return updated
}