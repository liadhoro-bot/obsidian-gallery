'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'

export async function updateRecipeYoutubeUrl(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()

  if (!recipeId) throw new Error('Missing recipe id')

  const { error } = await supabase
    .from('recipes')
    .update({
      youtube_url: youtubeUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath(`/recipes/${recipeId}`)
}