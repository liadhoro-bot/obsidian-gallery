'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import {
  completeOnboardingAction,
  completeOnboardingActions,
} from '../../../lib/onboarding/completion'
export async function updateRecipeVisibility(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')
  const isPublic = String(formData.get('isPublic') || '') === 'true'

  if (!recipeId) throw new Error('Missing guide id')

  const { error } = await supabase
    .from('recipes')
    .update({ is_public: isPublic })
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (error) throw error

  await completeOnboardingActions({
    userId: user.id,
    subjectGuideId: recipeId,
    actionKeys: ['set_guide_visibility', 'finish_first_guide'],
  })

  revalidatePath(`/recipes/${recipeId}`)
  revalidatePath('/recipes')
  revalidateTag(`recipe:${recipeId}`, 'max')
  revalidateTag('public-recipes', 'max')
}
export async function updateRecipeYoutubeUrl(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')
  const youtubeUrl = String(formData.get('youtubeUrl') || '').trim()

  if (!recipeId) throw new Error('Missing guide id')

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
  revalidateTag(`recipe:${recipeId}`, 'max')
  revalidateTag('public-recipes', 'max')
}

export async function markRecipePreviewed(recipeId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!recipeId) throw new Error('Missing guide id')

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!recipe) return

  await completeOnboardingAction({
    userId: user.id,
    actionKey: 'preview_guide',
    subjectGuideId: recipeId,
  })
}
