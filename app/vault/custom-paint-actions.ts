'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'

function cleanText(value: FormDataEntryValue | null, fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

function cleanHex(value: FormDataEntryValue | null) {
  const hex = String(value || '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : '#4A4F57'
}

function isMissingCustomPaintMigrationError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: string; message?: string }
  const message = candidate.message || ''

  return (
    candidate.code === 'PGRST204' ||
    message.includes("Could not find the 'description' column") ||
    message.includes('custom_paint_mix_paints') ||
    message.includes('schema cache')
  )
}

function customPaintMigrationError() {
  return new Error(
    'The custom paint mix database migration has not been applied yet. Run supabase/migrations/20260717120000_add_custom_paint_mix_details.sql, then reload the app.'
  )
}

function parsePaintSelection(rawValue: string) {
  if (!rawValue) {
    return {
      paint_source: null,
      catalog_paint_id: null,
      source_custom_paint_id: null,
    }
  }

  const [source, id] = rawValue.includes(':')
    ? rawValue.split(':')
    : ['catalog', rawValue]

  if (source === 'catalog' && id) {
    return {
      paint_source: 'catalog',
      catalog_paint_id: id,
      source_custom_paint_id: null,
    }
  }

  if (source === 'custom' && id) {
    return {
      paint_source: 'custom',
      catalog_paint_id: null,
      source_custom_paint_id: id,
    }
  }

  return {
    paint_source: null,
    catalog_paint_id: null,
    source_custom_paint_id: null,
  }
}

async function replaceCustomPaintMixPaints({
  supabase,
  userId,
  paintId,
  formData,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  paintId: string
  formData: FormData
}) {
  const mixPaintsToInsert = [1, 2, 3].flatMap((paintOrder) => {
    const rawPaintId = formData.get(`mixPaintId${paintOrder}`)?.toString() || ''
    const ratioText =
      formData.get(`mixRatio${paintOrder}`)?.toString().trim() || null
    const selection = parsePaintSelection(rawPaintId)

    if (!selection.paint_source) return []

    return [
      {
        custom_paint_id: paintId,
        user_id: userId,
        paint_source: selection.paint_source,
        catalog_paint_id: selection.catalog_paint_id,
        source_custom_paint_id: selection.source_custom_paint_id,
        paint_order: paintOrder,
        ratio_text: ratioText,
      },
    ]
  })

  const { error: deleteError } = await supabase
    .from('custom_paint_mix_paints')
    .delete()
    .eq('custom_paint_id', paintId)
    .eq('user_id', userId)

  if (isMissingCustomPaintMigrationError(deleteError)) {
    throw customPaintMigrationError()
  }

  if (deleteError) throw new Error(deleteError.message)

  if (mixPaintsToInsert.length === 0) return

  const { error: insertError } = await supabase
    .from('custom_paint_mix_paints')
    .insert(mixPaintsToInsert)

  if (isMissingCustomPaintMigrationError(insertError)) {
    throw customPaintMigrationError()
  }

  if (insertError) throw new Error(insertError.message)
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
  const series = cleanText(formData.get('line'), 'Custom Paint')
  const description = cleanText(formData.get('description')) || null
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
      description,
      color_hex,
      paint_type: 'custom',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

await captureServerEvent({
  distinctId: user.id,
  event: 'custom_color_created',
  properties: {
    custom_paint_id: paint.id,
    paint_name: name,
    manufacturer,
    series,
    paint_type: 'custom',
    has_color_hex: Boolean(color_hex),
    has_swatch_image: Boolean(file && file.size > 0),
    has_description: Boolean(description),
    source: 'vault_custom_paint_actions',
  },
})

  await replaceCustomPaintMixPaints({
    supabase,
    userId: user.id,
    paintId: paint.id,
    formData,
  })

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
  const series = cleanText(formData.get('line'), 'Custom Paint')
  const description = cleanText(formData.get('description')) || null
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
      description,
      color_hex,
    })
    .eq('id', paintId)
    .eq('user_id', user.id)

  if (isMissingCustomPaintMigrationError(error)) {
    throw customPaintMigrationError()
  }

  if (isMissingCustomPaintMigrationError(error)) {
    throw customPaintMigrationError()
  }

  if (error) throw new Error(error.message)

  await replaceCustomPaintMixPaints({
    supabase,
    userId: user.id,
    paintId,
    formData,
  })

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

  const { data: paint, error: paintError } = await supabase
    .from('paints')
    .select('id')
    .eq('id', paintId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (paintError) throw new Error(paintError.message)
  if (!paint) throw new Error('Paint not found.')

  await supabase
    .from('custom_paint_mix_paints')
    .delete()
    .eq('user_id', user.id)
    .or(`custom_paint_id.eq.${paintId},source_custom_paint_id.eq.${paintId}`)

  await supabase
    .from('recipe_step_paints')
    .delete()
    .eq('paint_source', 'custom')
    .eq('custom_paint_id', paintId)
    .eq('user_id', user.id)

  await supabase
    .from('unit_stage_paints')
    .delete()
    .eq('paint_source', 'custom')
    .eq('custom_paint_id', paintId)
    .eq('user_id', user.id)

  await supabase
    .from('theme_paints')
    .delete()
    .eq('paint_source', 'custom')
    .eq('custom_paint_id', paintId)

  await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'paint')
    .eq('entity_id', paintId)
    .eq('user_id', user.id)

  const { error } = await supabase
    .from('paints')
    .delete()
    .eq('id', paintId)
    .eq('user_id', user.id)

  if (isMissingCustomPaintMigrationError(error)) {
    throw customPaintMigrationError()
  }

  if (error) throw new Error(error.message)

  revalidatePath('/vault')
  redirect('/vault?tab=collection')
}
