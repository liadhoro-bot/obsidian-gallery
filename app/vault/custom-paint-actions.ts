'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

function cleanText(value: FormDataEntryValue | null, fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function cleanHex(value: FormDataEntryValue | null) {
  const hex = String(value || '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : '#4A4F57'
}

async function uploadCustomPaintSwatch({
  supabase,
  userId,
  paintId,
  file,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  paintId: string
  file: File | null
}) {
  if (!file || file.size === 0) return null

  const extension = file.name.split('.').pop() || 'png'
  const storagePath = `paints/${paintId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('obsidian-images')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = supabase.storage
    .from('obsidian-images')
    .getPublicUrl(storagePath)

  const imageUrl = data.publicUrl

  await supabase
    .from('image_assets')
    .update({ is_featured: false })
    .eq('entity_type', 'paint')
    .eq('entity_id', paintId)
    .eq('user_id', userId)

  const { error: imageError } = await supabase.from('image_assets').insert({
    entity_type: 'paint',
    entity_id: paintId,
    image_url: imageUrl,
    storage_bucket: 'obsidian-images',
    storage_path: storagePath,
    alt_text: 'Custom paint swatch',
    sort_order: 0,
    is_featured: true,
    user_id: userId,
  })

  if (imageError) {
    throw new Error(imageError.message)
  }

  return imageUrl
}

export async function createCustomPaintAction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('You must be logged in.')

  const name = cleanText(formData.get('name'))
  const manufacturer = cleanText(formData.get('brand'), 'Custom')
  const series = cleanText(formData.get('line'), 'Custom Color')
  const color_hex = cleanHex(formData.get('hex'))
  const file = formData.get('swatch') as File | null

  if (!name) throw new Error('Paint name is required.')

  const { data: paint, error } = await supabase
    .from('paints')
    .insert({
      user_id: user.id,
      name,
      manufacturer,
      series,
      color_hex,
      paint_type: 'custom',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await uploadCustomPaintSwatch({
    supabase,
    userId: user.id,
    paintId: paint.id,
    file,
  })

  revalidatePath('/vault')
}

export async function updateCustomPaintAction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('You must be logged in.')

  const paintId = cleanText(formData.get('paintId'))
  const name = cleanText(formData.get('name'))
  const manufacturer = cleanText(formData.get('brand'), 'Custom')
  const series = cleanText(formData.get('line'), 'Custom Color')
  const color_hex = cleanHex(formData.get('hex'))
  const file = formData.get('swatch') as File | null

  if (!paintId) throw new Error('Paint ID is missing.')
  if (!name) throw new Error('Paint name is required.')

  const { error } = await supabase
    .from('paints')
    .update({
      name,
      manufacturer,
      series,
      color_hex,
    })
    .eq('id', paintId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  await uploadCustomPaintSwatch({
    supabase,
    userId: user.id,
    paintId,
    file,
  })

  revalidatePath('/vault')
  revalidatePath(`/vault/custom/${paintId}`)
}

export async function deleteCustomPaintAction(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('You must be logged in.')

  const paintId = cleanText(formData.get('paintId'))

  if (!paintId) throw new Error('Paint ID is missing.')

  const { error } = await supabase
    .from('paints')
    .delete()
    .eq('id', paintId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/vault')
  redirect('/vault?tab=collection')
}