'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'

export async function updatePaintOwnership(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const paintCatalogId = String(formData.get('paintCatalogId') || '')
  const action = String(formData.get('action') || '')
  const currentValue = String(formData.get('currentValue') || '') === 'true'
  const currentUnits = Number(formData.get('currentUnits') || 0)

  if (!paintCatalogId) throw new Error('Missing paint id')

  const updates: {
    user_id: string
    paint_catalog_id: string
    is_owned?: boolean
    is_wishlist?: boolean
    units_owned?: number
  } = {
    user_id: user.id,
    paint_catalog_id: paintCatalogId,
  }

  if (action === 'owned') {
  const nextOwned = !currentValue

  updates.is_owned = nextOwned
  updates.units_owned = nextOwned ? Math.max(1, currentUnits) : 0
}

if (action === 'wishlist') {
  updates.is_wishlist = !currentValue
}

if (action === 'increment') {
  const nextUnits = currentUnits + 1

  updates.units_owned = nextUnits
  updates.is_owned = nextUnits > 0
}

if (action === 'decrement') {
  const nextUnits = Math.max(0, currentUnits - 1)

  updates.units_owned = nextUnits
  updates.is_owned = nextUnits > 0
}

  const { error } = await supabase
    .from('user_paint_ownership')
    .upsert(updates, {
      onConflict: 'user_id,paint_catalog_id',
    })

  if (error) throw new Error(error.message)

  revalidatePath(`/vault/catalog/${paintCatalogId}`)
  revalidatePath('/vault')
}