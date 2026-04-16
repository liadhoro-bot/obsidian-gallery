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

  const { data: existing } = await supabase
    .from('user_paint_ownership')
    .select('id')
    .eq('user_id', user.id)
    .eq('paint_catalog_id', paintId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('user_paint_ownership')
      .delete()
      .eq('id', existing.id)
  } else {
    await supabase.from('user_paint_ownership').insert({
      user_id: user.id,
      paint_catalog_id: paintId,
      is_owned: true,
    })
  }

  revalidatePath('/vault')
}