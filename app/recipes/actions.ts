'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'

export async function createRecipe(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const coverImage = formData.get('coverImage')

  if (!name) throw new Error('Guide name is required')

  let imageUrl: string | null = null

  if (coverImage instanceof File && coverImage.size > 0) {
    const fileExt = coverImage.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeFileName = `${crypto.randomUUID()}.${fileExt}`
    const filePath = `recipe-covers/${user.id}/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, coverImage, {
        contentType: coverImage.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    imageUrl = data.publicUrl
  }

  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      image_url: imageUrl,
      is_public: false,
    })
    .select('id, name, description, is_public, image_url')
    .single()

  if (error || !recipe) {
    throw new Error(error?.message || 'Could not create guide')
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_created',
    properties: {
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      is_public: recipe.is_public,
      has_description: Boolean(recipe.description),
      has_image: Boolean(recipe.image_url),
      source: 'recipes_custom_tab',
    },
  })

  revalidatePath('/recipes')
  redirect(`/recipes/${recipe.id}`)
}

export async function saveRecipe(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')

  if (!recipeId) throw new Error('Missing guide id')

  const { error } = await supabase.from('saved_recipes').upsert({
    user_id: user.id,
    recipe_id: recipeId,
  })

  if (error) throw error

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id, name, user_id')
    .eq('id', recipeId)
    .maybeSingle()

  await captureServerEvent({
    distinctId: user.id,
    event: 'recipe_saved',
    properties: {
      recipe_id: recipeId,
      recipe_name: recipe?.name || null,
      creator_id: recipe?.user_id || null,
    },
  })

  revalidatePath('/recipes')
}

export async function unsaveRecipe(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const recipeId = String(formData.get('recipeId') || '')

  if (!recipeId) throw new Error('Missing guide id')

  const { error } = await supabase
    .from('saved_recipes')
    .delete()
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)

  if (error) throw error

  revalidatePath('/recipes')
}
