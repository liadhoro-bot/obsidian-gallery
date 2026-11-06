export const NEWS_CATEGORIES = [
  'paints',
  'miniatures',
  'tools',
  'events',
  'og_announcement',
] as const

export type NewsCategory = (typeof NEWS_CATEGORIES)[number]
export type NewsStatus = 'draft' | 'published' | 'retracted'
export type NewsAvailability = 'draft' | 'scheduled' | 'live' | 'retracted'
export type NewsImageRights = 'og_original' | 'licensed' | 'permission'

export const newsCategoryLabels: Record<NewsCategory, string> = {
  paints: 'Paints',
  miniatures: 'Miniatures',
  tools: 'Tools',
  events: 'Events',
  og_announcement: 'Obsidian Gallery',
}

export const newsImageRightsLabels: Record<NewsImageRights, string> = {
  og_original: 'Our own image',
  licensed: 'Licensed',
  permission: 'Used with written permission',
}

// Official OG posts appear under All only.
export const NEWS_FILTERS = ['paints', 'miniatures', 'tools', 'events'] as const
export type NewsFilter = (typeof NEWS_FILTERS)[number]

export const NEWS_PAGE_SIZE = 12
const MAX_NEWS_PAGE = 50
export const MAX_HEADLINE_LENGTH = 120
export const TARGET_SUMMARY_WORDS = { min: 50, max: 100 }

export type NewsArticle = {
  id: string
  slug: string
  status: NewsStatus
  category: NewsCategory
  headline: string
  summary: string
  whyPaintersCare: string | null
  manufacturer: string | null
  sourceName: string | null
  sourceUrl: string | null
  sourcePublishedAt: string | null
  imageUrl: string | null
  imageAlt: string | null
  imageCredit: string | null
  imageRights: NewsImageRights | null
  publishedAt: string | null
  firstPublishedAt: string | null
  retractedAt: string | null
  updatedAt: string
}

export const NEWS_COLUMNS =
  'id, slug, status, category, headline, summary, why_painters_care, manufacturer, source_name, source_url, source_published_at, image_url, image_alt, image_credit, image_rights, published_at, first_published_at, retracted_at, updated_at'

export type NewsArticleRow = {
  id: string
  slug: string
  status: NewsStatus
  category: NewsCategory
  headline: string
  summary: string
  why_painters_care: string | null
  manufacturer: string | null
  source_name: string | null
  source_url: string | null
  source_published_at: string | null
  image_url: string | null
  image_alt: string | null
  image_credit: string | null
  image_rights: NewsImageRights | null
  published_at: string | null
  first_published_at: string | null
  retracted_at: string | null
  updated_at: string
}

export function toNewsArticle(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    category: row.category,
    headline: row.headline,
    summary: row.summary,
    whyPaintersCare: row.why_painters_care,
    manufacturer: row.manufacturer,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourcePublishedAt: row.source_published_at,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageCredit: row.image_credit,
    imageRights: row.image_rights,
    publishedAt: row.published_at,
    firstPublishedAt: row.first_published_at,
    retractedAt: row.retracted_at,
    updatedAt: row.updated_at,
  }
}

export function newsArticleHref(slug: string) {
  return `/community/news/${slug}`
}

export function newsFeedHref(filter: NewsFilter | null, page = 1) {
  const params = new URLSearchParams()
  if (filter) params.set('category', filter)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/community/news?${query}` : '/community/news'
}

export function parseNewsFilter(value: unknown): NewsFilter | null {
  return NEWS_FILTERS.find((filter) => filter === value) ?? null
}

export function parseNewsPage(value: unknown) {
  const page = typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : 1
  return Math.min(Math.max(page, 1), MAX_NEWS_PAGE)
}

export function getNewsAvailability(
  article: Pick<NewsArticle, 'status' | 'publishedAt'>,
  now = new Date()
): NewsAvailability {
  if (article.status !== 'published') return article.status
  return article.publishedAt && new Date(article.publishedAt) <= now ? 'live' : 'scheduled'
}

export function slugifyHeadline(headline: string) {
  return headline
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '')
}

export function isValidNewsSlug(slug: string) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 96
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function splitParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

// Stops javascript: and other non-web links reaching the article's button.
export function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export type NewsDraftFields = {
  headline: string
  summary: string
  category: string
  sourceName: string
  sourceUrl: string
  sourcePublishedAt: string
  hasImage: boolean
  imageRights: string
}

export function validateNewsDraft(fields: Pick<NewsDraftFields, 'headline' | 'category' | 'sourceUrl'>) {
  if (!fields.headline.trim()) return 'Add a headline.'
  if (fields.headline.trim().length > MAX_HEADLINE_LENGTH) {
    return `Keep the headline to ${MAX_HEADLINE_LENGTH} characters.`
  }
  if (!NEWS_CATEGORIES.includes(fields.category as NewsCategory)) return 'Choose a category.'
  if (fields.sourceUrl.trim() && !normalizeSourceUrl(fields.sourceUrl)) {
    return 'The source link must be a full http or https address.'
  }
  return null
}

// What a reader must always be able to see before an article goes live.
export function validateNewsForPublish(fields: NewsDraftFields) {
  const draftError = validateNewsDraft(fields)
  if (draftError) return draftError
  if (!fields.summary.trim()) return 'Add a summary before publishing.'
  if (fields.hasImage && !fields.imageRights) {
    return 'State the rights for this image, or remove it to use the fallback artwork.'
  }
  if (fields.category !== 'og_announcement') {
    if (!fields.sourceName.trim()) return 'Add the source name before publishing.'
    if (!fields.sourceUrl.trim()) return 'Add the original source link before publishing.'
    if (!fields.sourcePublishedAt) return 'Add the date the source announced this.'
  }
  return null
}

const DAY_MS = 24 * 60 * 60 * 1000

export function formatNewsDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export function formatNewsAge(value: string, now = new Date()) {
  const elapsed = now.getTime() - new Date(value).getTime()
  const hours = Math.floor(elapsed / (60 * 60 * 1000))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(elapsed / DAY_MS)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatNewsDate(value)
}

export function getNewsSourceLabel(
  article: Pick<NewsArticle, 'category' | 'manufacturer' | 'sourceName'>
) {
  if (article.category === 'og_announcement') return 'Obsidian Gallery'
  return article.manufacturer || article.sourceName || ''
}
