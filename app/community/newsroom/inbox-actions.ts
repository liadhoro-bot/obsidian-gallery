'use server'

import { revalidatePath } from 'next/cache'
import { runNewsIngestion } from '../../../lib/news/ingest/run'
import { isValidNewsSlug, slugifyHeadline, MAX_HEADLINE_LENGTH } from '../news/news-data'
import { findFreeSlug, requireNewsAdmin, type NewsSupabase } from './newsroom-admin'

export type InboxActionResult = { ok: true; message?: string; articleId?: string } | { ok: false; error: string }

const NOT_ADMIN: InboxActionResult = { ok: false, error: 'Only admins can use the news inbox.' }

async function logEvent(
  supabase: NewsSupabase,
  event: {
    event_type: string
    actor_id: string
    source_id?: string | null
    source_item_id?: string | null
    article_id?: string | null
    details?: Record<string, unknown>
  }
) {
  const { error } = await supabase.from('news_editorial_events').insert(event)
  if (error) console.error('Failed to record a newsroom event', error)
}

async function setItemState(itemId: string, from: string, to: string, eventType: string) {
  const admin = await requireNewsAdmin()
  if (!admin) return NOT_ADMIN
  const { supabase, user } = admin

  const { data, error } = await supabase
    .from('news_source_items')
    .update({ state: to })
    .eq('id', itemId)
    .eq('state', from)
    .select('id, source_id')
  if (error) {
    console.error('Failed to update a news inbox item', error)
    return { ok: false, error: 'That item could not be updated.' } satisfies InboxActionResult
  }
  if (!data?.length) return { ok: false, error: 'That item has already changed. Refresh to see it.' } satisfies InboxActionResult

  await logEvent(supabase, {
    event_type: eventType,
    actor_id: user.id,
    source_id: data[0].source_id,
    source_item_id: itemId,
  })
  revalidatePath('/community/newsroom/inbox')
  return { ok: true } satisfies InboxActionResult
}

export async function dismissInboxItem(itemId: string): Promise<InboxActionResult> {
  return setItemState(itemId, 'new', 'dismissed', 'item_dismissed')
}

export async function restoreInboxItem(itemId: string): Promise<InboxActionResult> {
  return setItemState(itemId, 'dismissed', 'new', 'item_restored')
}

type ItemForDraft = {
  id: string
  state: string
  title: string
  canonical_url: string
  published_at: string | null
  news_sources: { id: string; name: string; manufacturer: string | null; default_category: string } | null
}

// Starts an editable draft from a collected item: headline and attribution
// are filled in, the summary is left for the editor to write.
export async function startDraftFromItem(itemId: string): Promise<InboxActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return NOT_ADMIN
  const { supabase, user } = admin

  const { data: existingLink } = await supabase
    .from('news_article_sources')
    .select('article_id')
    .eq('source_item_id', itemId)
    .limit(1)
    .maybeSingle()
  if (existingLink) return { ok: true, articleId: existingLink.article_id }

  const { data, error } = await supabase
    .from('news_source_items')
    .select('id, state, title, canonical_url, published_at, news_sources(id, name, manufacturer, default_category)')
    .eq('id', itemId)
    .maybeSingle()
  const item = data as unknown as ItemForDraft | null
  if (error || !item || !item.news_sources) return { ok: false, error: 'That item no longer exists.' }

  const headline = item.title.slice(0, MAX_HEADLINE_LENGTH).trim()
  const baseSlug = slugifyHeadline(headline)
  const slug = await findFreeSlug(supabase, isValidNewsSlug(baseSlug) ? baseSlug : 'news-item', null)

  const { data: article, error: insertError } = await supabase
    .from('news_articles')
    .insert({
      slug,
      status: 'draft',
      category: item.news_sources.default_category,
      headline,
      summary: '',
      manufacturer: item.news_sources.manufacturer,
      source_name: item.news_sources.name,
      source_url: item.canonical_url,
      source_published_at: item.published_at ? item.published_at.slice(0, 10) : null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single()
  if (insertError || !article) {
    console.error('Failed to start a draft from a news item', insertError)
    return { ok: false, error: 'The draft could not be created.' }
  }

  const [link, stateUpdate] = await Promise.all([
    supabase.from('news_article_sources').insert({ article_id: article.id, source_item_id: item.id }),
    supabase.from('news_source_items').update({ state: 'drafted' }).eq('id', item.id),
  ])
  if (link.error || stateUpdate.error) {
    console.error('Failed to link a draft to its news item', link.error ?? stateUpdate.error)
  }

  await logEvent(supabase, {
    event_type: 'draft_started',
    actor_id: user.id,
    source_id: item.news_sources.id,
    source_item_id: item.id,
    article_id: article.id,
  })
  revalidatePath('/community/newsroom')
  revalidatePath('/community/newsroom/inbox')
  return { ok: true, articleId: article.id }
}

export async function runSourceNow(sourceId: string): Promise<InboxActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return NOT_ADMIN
  const { supabase, user } = admin

  await logEvent(supabase, { event_type: 'run_requested', actor_id: user.id, source_id: sourceId })
  try {
    const [result] = await runNewsIngestion({ trigger: 'manual', sourceId, budgetMs: 40_000 })
    revalidatePath('/community/newsroom/sources')
    revalidatePath('/community/newsroom/inbox')
    if (!result) return { ok: false, error: 'This source is turned off.' }
    if (result.status === 'skipped') return { ok: false, error: 'This source is already being collected. Try again shortly.' }
    if (result.status === 'failed') return { ok: false, error: `Collection failed: ${result.error}` }
    return {
      ok: true,
      message: `Found ${result.itemsSeen}: ${result.itemsNew} new, ${result.itemsDuplicate} already known${
        result.itemsSkipped ? `, ${result.itemsSkipped} left for later` : ''
      }.`,
    }
  } catch (error) {
    console.error('Manual news collection failed', error)
    return { ok: false, error: 'Collection could not start.' }
  }
}

export async function setSourceEnabled(sourceId: string, enabled: boolean): Promise<InboxActionResult> {
  const admin = await requireNewsAdmin()
  if (!admin) return NOT_ADMIN
  const { supabase, user } = admin

  const { error } = await supabase
    .from('news_sources')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', sourceId)
  if (error) {
    // news_sources_enabled_needs_permission
    if (error.code === '23514') {
      return { ok: false, error: 'Record that collection is allowed (terms or written permission) before turning this on.' }
    }
    console.error('Failed to change a news source', error)
    return { ok: false, error: 'The source could not be changed.' }
  }

  await logEvent(supabase, {
    event_type: enabled ? 'source_enabled' : 'source_disabled',
    actor_id: user.id,
    source_id: sourceId,
  })
  revalidatePath('/community/newsroom/sources')
  return { ok: true }
}
