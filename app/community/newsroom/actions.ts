'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import {
  isValidNewsSlug,
  newsArticleHref,
  normalizeSourceUrl,
  slugifyHeadline,
  validateNewsDraft,
  validateNewsForPublish,
  type NewsDraftFields,
} from '../news/news-data'
import { findFreeSlug, requireNewsAdmin, type NewsSupabase } from './newsroom-admin'

const IMAGE_BUCKET = 'obsidian-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type NewsActionResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string }

type StoredArticle = {
  id: string
  slug: string
  status: string
  published_at: string | null
  first_published_at: string | null
  image_url: string | null
  image_storage_path: string | null
}

const STORED_COLUMNS =
  'id, slug, status, published_at, first_published_at, image_url, image_storage_path'

async function loadStoredArticle(supabase: NewsSupabase, id: string) {
  const { data } = await supabase
    .from('news_articles')
    .select(STORED_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return data as StoredArticle | null
}

function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function refreshNewsPages(slug: string) {
  revalidatePath('/community')
  revalidatePath('/community/news')
  revalidatePath(newsArticleHref(slug))
  revalidatePath('/community/newsroom')
}

export async function saveNewsArticle(formData: FormData): Promise<NewsActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return { ok: false, error: 'Only admins can edit news.' }
  const { supabase, user } = admin

  const id = text(formData, 'id') || null
  const isPublishing = text(formData, 'intent') === 'publish'

  const existing = id ? await loadStoredArticle(supabase, id) : null
  if (id && !existing) return { ok: false, error: 'This article no longer exists.' }

  const imageFile = formData.get('image')
  const newImage = imageFile instanceof File && imageFile.size > 0 ? imageFile : null
  const removeImage = text(formData, 'removeImage') === '1'

  const fields: NewsDraftFields = {
    headline: text(formData, 'headline'),
    summary: text(formData, 'summary'),
    category: text(formData, 'category'),
    sourceName: text(formData, 'sourceName'),
    sourceUrl: text(formData, 'sourceUrl'),
    sourcePublishedAt: text(formData, 'sourcePublishedAt'),
    hasImage: Boolean(newImage) || (Boolean(existing?.image_url) && !removeImage),
    imageRights: text(formData, 'imageRights'),
  }

  // Edits to a published article must keep it publishable.
  const validationError =
    isPublishing || existing?.status === 'published'
      ? validateNewsForPublish(fields)
      : validateNewsDraft(fields)
  if (validationError) return { ok: false, error: validationError }

  if (newImage) {
    if (!IMAGE_TYPES[newImage.type]) return { ok: false, error: 'Use a JPEG, PNG or WebP image.' }
    if (newImage.size > MAX_IMAGE_BYTES) return { ok: false, error: 'Keep the image under 5 MB.' }
  }

  const now = new Date()
  const publishAtValue = text(formData, 'publishAt')
  const publishAt = publishAtValue ? new Date(publishAtValue) : null
  if (publishAt && Number.isNaN(publishAt.getTime())) {
    return { ok: false, error: 'That publish time is not valid.' }
  }

  const isScheduled =
    existing?.status === 'published' && new Date(existing.published_at as string) > now
  const timing: Record<string, string | null> = {}

  if (isPublishing || (isScheduled && publishAt)) {
    if (publishAt && publishAt <= now) {
      return { ok: false, error: 'Choose a future time, or clear it to publish now.' }
    }
    const publishedAt = (publishAt ?? now).toISOString()
    timing.status = 'published'
    timing.published_at = publishedAt
    timing.first_published_at = existing?.first_published_at ?? publishedAt
    timing.retracted_at = null
  }

  // The public URL stops changing the first time an article is published.
  let slug = existing?.slug ?? ''
  if (!existing?.first_published_at) {
    const requested = text(formData, 'slug') || slugifyHeadline(fields.headline)
    if (!isValidNewsSlug(requested)) {
      return { ok: false, error: 'The URL slug can only use lowercase letters, numbers and hyphens.' }
    }
    slug = await findFreeSlug(supabase, requested, id)
  }

  const image: Record<string, string | null> = {}
  if (newImage) {
    const path = `users/${user.id}/news/${randomUUID()}.${IMAGE_TYPES[newImage.type]}`
    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, newImage, { contentType: newImage.type, cacheControl: '31536000' })
    if (uploadError) {
      console.error('Failed to upload news image', uploadError)
      return { ok: false, error: 'The image could not be uploaded.' }
    }
    image.image_url = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    image.image_storage_path = path
  } else if (removeImage) {
    image.image_url = null
    image.image_storage_path = null
  }

  const row = {
    slug,
    category: fields.category,
    headline: fields.headline,
    summary: fields.summary,
    why_painters_care: text(formData, 'whyPaintersCare') || null,
    manufacturer: text(formData, 'manufacturer') || null,
    source_name: fields.sourceName || null,
    source_url: fields.sourceUrl ? normalizeSourceUrl(fields.sourceUrl) : null,
    source_published_at: fields.sourcePublishedAt || null,
    image_alt: fields.hasImage ? text(formData, 'imageAlt') || null : null,
    image_credit: fields.hasImage ? text(formData, 'imageCredit') || null : null,
    image_rights: fields.hasImage ? fields.imageRights || null : null,
    updated_by: user.id,
    updated_at: now.toISOString(),
    ...image,
    ...timing,
  }

  const result = existing
    ? await supabase.from('news_articles').update(row).eq('id', existing.id).select('id, slug').single()
    : await supabase
        .from('news_articles')
        .insert({ ...row, created_by: user.id })
        .select('id, slug')
        .single()

  if (result.error || !result.data) {
    console.error('Failed to save news article', result.error)
    return { ok: false, error: 'The article could not be saved. Nothing was published.' }
  }

  if ((newImage || removeImage) && existing?.image_storage_path) {
    await supabase.storage.from(IMAGE_BUCKET).remove([existing.image_storage_path])
  }

  refreshNewsPages(result.data.slug)
  return { ok: true, id: result.data.id, slug: result.data.slug }
}

// Takes a live article down, or returns a scheduled one to draft.
export async function withdrawNewsArticle(id: string): Promise<NewsActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return { ok: false, error: 'Only admins can edit news.' }
  const { supabase, user } = admin

  const existing = await loadStoredArticle(supabase, id)
  if (!existing || existing.status !== 'published') {
    return { ok: false, error: 'This article is not published.' }
  }

  const now = new Date()
  const isLive = new Date(existing.published_at as string) <= now
  const { error } = await supabase
    .from('news_articles')
    .update({
      status: isLive ? 'retracted' : 'draft',
      retracted_at: isLive ? now.toISOString() : null,
      updated_by: user.id,
      updated_at: now.toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to withdraw news article', error)
    return { ok: false, error: 'The article could not be taken down. Try again.' }
  }

  refreshNewsPages(existing.slug)
  return { ok: true, id, slug: existing.slug }
}

// Published articles must be retracted first, so one tap can't remove a live page.
export async function deleteNewsArticle(id: string): Promise<NewsActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return { ok: false, error: 'Only admins can edit news.' }
  const { supabase } = admin

  const existing = await loadStoredArticle(supabase, id)
  if (!existing) return { ok: false, error: 'This article no longer exists.' }
  if (existing.status === 'published') {
    return { ok: false, error: 'Retract this article before deleting it.' }
  }

  const { error } = await supabase
    .from('news_articles')
    .delete()
    .eq('id', id)
    .neq('status', 'published')

  if (error) {
    console.error('Failed to delete news article', error)
    return { ok: false, error: 'The article could not be deleted.' }
  }

  if (existing.image_storage_path) {
    await supabase.storage.from(IMAGE_BUCKET).remove([existing.image_storage_path])
  }

  refreshNewsPages(existing.slug)
  return { ok: true, id, slug: existing.slug }
}
