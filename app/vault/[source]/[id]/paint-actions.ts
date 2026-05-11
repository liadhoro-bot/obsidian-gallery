'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../../utils/supabase/server'
import { updatePaintOwnership as updateCentralPaintOwnership } from '../../../../utils/paint-ownership/update-paint-ownership'

export async function updatePaintOwnership(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const paintCatalogId = String(formData.get('paintCatalogId') || '')
  const action = String(formData.get('action') || '') as
    | 'owned'
    | 'wishlist'
    | 'increment'
    | 'decrement'

  const currentValueRaw = formData.get('currentValue')
  const currentUnitsRaw = formData.get('currentUnits')

  if (!paintCatalogId) throw new Error('Missing paint id')

  await updateCentralPaintOwnership({
    userId: user.id,
    paintCatalogId,
    action,
    currentValue:
      currentValueRaw === null ? undefined : currentValueRaw === 'true',
    currentUnits:
      currentUnitsRaw === null ? undefined : Number(currentUnitsRaw || 0),
  })

  revalidatePath('/vault')
  revalidatePath(`/vault/catalog/${paintCatalogId}`)
}