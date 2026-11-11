import { createHash } from 'node:crypto'

// Cheap, deterministic triage. No AI calls happen during collection; this
// only decides what the inbox shows first. Editors make the real call.

const RELEASE_TERMS = [
  'new release', 'pre-order', 'preorder', 'pre order', 'now available', 'available now',
  'out now', 'coming soon', 'launch', 'announc', 'reveal', 'release', 'arriving', 'in stores',
  'new range', 'new paint', 'new kit', 'new miniature', 'new box', 'new set', 'unveil', 'first look',
]

const HOBBY_TERMS = [
  'paint', 'colour', 'color', 'brush', 'primer', 'airbrush', 'wash', 'ink', 'contrast', 'speedpaint',
  'miniature', 'kit', 'model', 'box', 'starter', 'army', 'faction', 'range', 'plastic', 'resin',
  'terrain', 'scenery', 'codex', 'battletome', 'rulebook', 'edition', 'bundle', 'set',
]

// Usually not news: tutorials, promotions, company notices.
const NOT_NEWS_TERMS = [
  'scam', 'tips', 'tutorial', 'how to', 'how do you', 'guide to', 'interview', 'podcast',
  'livestream', 'giveaway', 'competition winner', 'hiring', 'vacanc', 'job opening', 'sale',
  'discount', 'black friday', 'cyber monday', 'celebrat', 'behind the scenes', 'showcase',
  'painting challenge', 'round-up', 'round up', 'roundup', 'recap',
]

export type Relevance = 'relevant' | 'maybe' | 'irrelevant'

function matches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term))
}

export function classifyRelevance(title: string, excerpt: string): { relevance: Relevance; reasons: string[] } {
  const titleText = title.toLowerCase()
  const fullText = `${titleText} ${excerpt.toLowerCase()}`
  const release = matches(fullText, RELEASE_TERMS)
  const hobby = matches(fullText, HOBBY_TERMS)
  const notNews = matches(titleText, NOT_NEWS_TERMS)

  const score =
    Math.min(release.length, 2) * 2 + Math.min(hobby.length, 2) - notNews.length * 3
  const relevance: Relevance = score >= 3 ? 'relevant' : score >= 1 ? 'maybe' : 'irrelevant'
  const reasons = [
    ...release.slice(0, 3).map((term) => `release: ${term}`),
    ...hobby.slice(0, 3).map((term) => `hobby: ${term}`),
    ...notNews.slice(0, 3).map((term) => `not news: ${term}`),
  ]
  return { relevance, reasons }
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were', 'you', 'your', 'our',
  'new', 'now', 'its', 'into', 'out', 'all', 'more', 'about', 'have', 'has', 'will', 'here', 'what',
  'how', 'why', 'get', 'got', 'can', 'just', 'their', 'they', 'them', 'his', 'her', 'not', 'but',
])

export function titleTokens(title: string) {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  return [...new Set(words)]
}

export function titleKey(title: string) {
  return titleTokens(title).sort().join(' ')
}

export function titleSimilarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return { shared: 0, score: 0 }
  const set = new Set(a)
  const shared = b.filter((word) => set.has(word)).length
  return { shared, score: shared / (a.length + b.length - shared) }
}

// Secondary, fuzzy grouping of reports about the same event. Exact title keys
// always match; otherwise titles must share most of their significant words.
export function isSameStory(a: string[], b: string[]) {
  if (a.length > 0 && [...a].sort().join(' ') === [...b].sort().join(' ')) return true
  const { shared, score } = titleSimilarity(a, b)
  return shared >= 3 && score >= 0.6
}

export function contentFingerprint(title: string, publishedAt: Date | null, canonicalUrl: string) {
  const key = titleKey(title) || canonicalUrl
  const day = publishedAt ? publishedAt.toISOString().slice(0, 10) : ''
  return createHash('sha256').update(`${key}|${day}`).digest('hex')
}
