import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { connection } from 'next/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import {
  isValidNewsSlug,
  NEWS_COLUMNS,
  NEWS_PAGE_SIZE,
  toNewsArticle,
  type NewsArticle,
  type NewsArticleRow,
  type NewsFilter,
} from './news-data'

// Public pages read as anon, without the visitor's cookies. The proxy doesn't
// refresh sessions on public routes, so a cookie client here could rotate a
// member's refresh token without saving it and sign them out. Without cookies
// Next can't tell these reads are dynamic, so each one calls connection() or
// the build would freeze today's news into the page.
function liveArticles() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
    .from('news_articles')
    .select(NEWS_COLUMNS)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
}

export async function getLatestNews(limit: number): Promise<NewsArticle[]> {
  await connection()
  const { data, error } = await liveArticles()
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to load latest news', error)
    return []
  }

  return (data as NewsArticleRow[]).map(toNewsArticle)
}

export type NewsFeed = { articles: NewsArticle[]; hasMore: boolean; failed: boolean }

// Page n shows everything up to page n, so "Show more" links are shareable.
export async function getNewsFeed(filter: NewsFilter | null, page: number): Promise<NewsFeed> {
  await connection()
  const visible = page * NEWS_PAGE_SIZE
  const query = filter ? liveArticles().eq('category', filter) : liveArticles()

  const { data, error } = await query
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .range(0, visible)

  if (error) {
    console.error('Failed to load news feed', error)
    return { articles: [], hasMore: false, failed: true }
  }

  const rows = data as NewsArticleRow[]
  return {
    articles: rows.slice(0, visible).map(toNewsArticle),
    hasMore: rows.length > visible,
    failed: false,
  }
}

export async function getPublishedNewsArticle(slug: string): Promise<NewsArticle | null> {
  if (!isValidNewsSlug(slug)) return null

  await connection()
  const { data, error } = await liveArticles().eq('slug', slug).maybeSingle()

  if (error) {
    console.error('Failed to load news article', error)
    return null
  }

  return data ? toNewsArticle(data as NewsArticleRow) : null
}

// Newsroom reads see every status, so callers must pass requireNewsroomAccess
// first. Admins come from ADMIN_USER_IDS, which RLS can't see.
export async function getNewsroomArticles(): Promise<NewsArticle[]> {
  const { data, error } = await createServiceRoleClient()
    .from('news_articles')
    .select(NEWS_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to load newsroom articles', error)
    return []
  }

  return (data as NewsArticleRow[]).map(toNewsArticle)
}

export async function getNewsroomArticle(id: string): Promise<NewsArticle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const { data, error } = await createServiceRoleClient()
    .from('news_articles')
    .select(NEWS_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load newsroom article', error)
    return null
  }

  return data ? toNewsArticle(data as NewsArticleRow) : null
}
