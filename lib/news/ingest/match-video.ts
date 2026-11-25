import { titleTokens } from './classify'
import type { Candidate, SourceContext } from './collect'

// Finds the maker's own video about a story, so drafts and digest cards come
// with an official picture. Only the maker's official channel is searched, and
// a result is used only when its title clearly names the same thing.

// Words that say nothing about which story a title is about.
const GENERIC_WORDS = new Set([
  'warhammer', '40k', '000', 'games', 'workshop', 'next', 'week', 'weekly', 'pre', 'order', 'orders', 'preview',
  'previews', 'news', 'today', 'update', 'updates', 'live', 'new', 'first', 'look', 'reveal', 'revealed', 'reveals',
  'coming', 'soon', 'announced', 'announcement', 'available', 'big', 'official', 'trailer', 'video', 'watch', 'full',
  'rules', 'army', 'armies', 'kit', 'kits', 'miniatures', 'models', 'range', 'set', 'box', 'release', 'releases',
])

function storyWords(title: string) {
  return titleTokens(title).filter((word) => !GENERIC_WORDS.has(word))
}

export function videoSearchQuery(title: string) {
  return storyWords(title).slice(0, 6).join(' ')
}

// At least two distinctive words in common, covering half of the shorter title.
export function isMatchingVideo(storyTitle: string, videoTitle: string) {
  const story = storyWords(storyTitle)
  const video = new Set(storyWords(videoTitle))
  if (story.length === 0 || video.size === 0) return false
  const shared = story.filter((word) => video.has(word)).length
  return shared >= 2 && shared / Math.min(story.length, video.size) >= 0.5
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

type SearchResult = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    thumbnails?: Record<string, { url?: string } | undefined>
  }
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const SEARCH_LOOKBACK_DAYS = 45

// One search.list call: 100 of YouTube's 10,000 free daily quota units.
export async function searchOfficialVideo(
  context: Pick<SourceContext, 'fetchApi' | 'youtubeApiKey' | 'now'>,
  channelId: string,
  storyTitle: string,
  storyDate: Date | null
): Promise<Candidate | null> {
  if (!context.youtubeApiKey) throw new Error('YOUTUBE_API_KEY is not set')
  const query = videoSearchQuery(storyTitle)
  if (!query) return null

  const anchor = storyDate ?? context.now
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    q: query,
    type: 'video',
    order: 'relevance',
    maxResults: '5',
    publishedAfter: new Date(anchor.getTime() - SEARCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    key: context.youtubeApiKey,
  })
  const response = await context.fetchApi(`https://www.googleapis.com/youtube/v3/search?${params}`, 'googleapis.com')
  let results: SearchResult[]
  try {
    results = (JSON.parse(response.text) as { items?: SearchResult[] }).items ?? []
  } catch {
    throw new Error('YouTube search returned invalid JSON')
  }

  for (const result of results) {
    const videoId = result.id?.videoId
    const snippet = result.snippet
    if (!videoId || !VIDEO_ID.test(videoId) || !snippet?.title) continue
    const title = decodeEntities(snippet.title).trim()
    if (!isMatchingVideo(storyTitle, title)) continue
    const thumbnails = snippet.thumbnails ?? {}
    const thumbnailUrl = ['high', 'medium', 'standard', 'default']
      .map((size) => thumbnails[size]?.url)
      .find((url): url is string => Boolean(url && url.startsWith('https://i.ytimg.com/')))
    const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : null
    return {
      externalId: `youtube:${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: title.slice(0, 300),
      excerpt: decodeEntities(snippet.description ?? '').trim().slice(0, 500),
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      needsMetadata: false,
      videoId,
      thumbnailUrl: thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    }
  }
  return null
}
