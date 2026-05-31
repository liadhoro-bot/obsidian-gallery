'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'

export async function createTheme(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const tagsInput = String(formData.get('tags') || '').trim()
  const imageFile = formData.get('image') as File | null

  if (!name) {
    throw new Error('Theme name is required.')
  }

  const tags = tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .insert({
      user_id: user.id,
      name,
      description,
      tags,
      is_public: false,
    })
    .select('id')
    .single()

  if (themeError) {
    throw new Error(themeError.message)
  }

  if (!theme?.id) {
    throw new Error('Theme was created, but no theme id was returned.')
  }

  if (imageFile && imageFile.size > 0) {
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('Uploaded file must be an image.')
    }

    const fileExt = imageFile.name.split('.').pop() || 'jpg'
    const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const filePath = `themes/${theme.id}/hero.${cleanExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, imageFile, {
        upsert: true,
        contentType: imageFile.type,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from('obsidian-images')
      .getPublicUrl(filePath)

    const imageUrl = data.publicUrl

    const { error: updateError } = await supabase
      .from('themes')
      .update({ image_url: imageUrl })
      .eq('id', theme.id)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

await captureServerEvent({
  distinctId: user.id,
  event: 'theme_created',
  properties: {
    theme_id: theme.id,
    theme_name: name,
    is_public: false,
    has_description: Boolean(description),
    has_tags: tags.length > 0,
    tag_count: tags.length,
    has_image: Boolean(imageFile && imageFile.size > 0),
    source: 'themes_page',
  },
})

  const paintRows = []

  for (let index = 0; index < 5; index++) {
    const source = String(formData.get(`paint_source_${index}`) || '')
    const paintId = String(formData.get(`paint_id_${index}`) || '')

    if (!source || !paintId) continue

    paintRows.push({
      theme_id: theme.id,
      paint_source: source,
      paint_catalog_id: source === 'catalog' ? paintId : null,
      custom_paint_id: source === 'custom' ? paintId : null,
      sort_order: index + 1,
    })
  }

  if (paintRows.length > 0) {
    const { error: paintsError } = await supabase
      .from('theme_paints')
      .insert(paintRows)

    if (paintsError) {
      throw new Error(paintsError.message)
    }
  }

  revalidatePath('/themes')
  revalidatePath(`/themes/${theme.id}`)
  revalidateTag('public-themes', 'max')
  revalidateTag(`theme:${theme.id}`, 'max')

  redirect(`/themes/${theme.id}`)
}

export async function saveTheme(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const themeId = String(formData.get('themeId') || '')

  if (!themeId) throw new Error('Missing theme id')

  const { data: theme, error: themeError } = await supabase
    .from('themes')
    .select('id, name, user_id, is_public')
    .eq('id', themeId)
    .maybeSingle()

  if (themeError) throw themeError

  if (!theme || !theme.is_public) {
    throw new Error('Theme is not available to save.')
  }

  if (theme.user_id === user.id) {
    revalidatePath('/themes')
    return
  }

  const { error } = await supabase.from('saved_themes').upsert({
    user_id: user.id,
    theme_id: themeId,
  })

  if (error) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'theme_saved',
    properties: {
      theme_id: themeId,
      theme_name: theme.name || null,
      creator_id: theme.user_id || null,
    },
  })

  revalidatePath('/themes')
}

export async function unsaveTheme(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const themeId = String(formData.get('themeId') || '')

  if (!themeId) throw new Error('Missing theme id')

  const { error } = await supabase
    .from('saved_themes')
    .delete()
    .eq('user_id', user.id)
    .eq('theme_id', themeId)

  if (error) throw error

  revalidatePath('/themes')
}
