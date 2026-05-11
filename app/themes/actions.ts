'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

export async function createTheme(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const tagsInput = String(formData.get('tags') || '').trim()
  const imageFile = formData.get('image') as File | null

  if (!name) return

  const tags = tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  const { data: theme, error } = await supabase
    .from('themes')
    .insert({
      user_id: user.id,
      name,
      description,
      tags,
      is_public: false,
    })
    .select()
    .single()

  if (error || !theme) {
    console.error(error)
    return
  }

  let imageUrl: string | null = null

  if (imageFile && imageFile.size > 0) {
    const fileExt = imageFile.name.split('.').pop() || 'jpg'
    const filePath = `themes/${theme.id}/hero.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('obsidian-images')
      .upload(filePath, imageFile, {
        upsert: true,
        contentType: imageFile.type,
      })

    if (!uploadError) {
      const { data } = supabase.storage
        .from('obsidian-images')
        .getPublicUrl(filePath)

      imageUrl = data.publicUrl

      await supabase
        .from('themes')
        .update({ image_url: imageUrl })
        .eq('id', theme.id)
    }
  }

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
    await supabase.from('theme_paints').insert(paintRows)
  }

  revalidatePath('/themes')
  redirect(`/themes/${theme.id}`)
}