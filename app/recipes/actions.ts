'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'

export async function saveRecipe(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')

  if (!recipeId) throw new Error('Missing recipe id')

  const { error } = await supabase.from('saved_recipes').upsert({
    user_id: user.id,
    recipe_id: recipeId,
  })

  if (error) throw error

  revalidatePath('/recipes')
}

export async function unsaveRecipe(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')

  if (!recipeId) throw new Error('Missing recipe id')

  const { error } = await supabase
    .from('saved_recipes')
    .delete()
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)

  if (error) throw error

  revalidatePath('/recipes')
}