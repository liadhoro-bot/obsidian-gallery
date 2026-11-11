import { MAX_EXCERPT_LENGTH, MAX_TITLE_LENGTH, extractLinks, extractPageMeta, parseFeed, parseSitemap } from './parse'
import { isAllowedByRobots, parseRobots, type RobotsPolicy } from './robots'
import { fetchSourceText, SourceFetchError, type FetchedText } from './safe-fetch'
import { titleFromUrl, toPlainText } from './text'
import { canonicalizeUrl } from './url'

export type DiscoveryMethod = 'feed' | 'sitemap' | 'html_listing' | 'release_page'

export type NewsSourceConfig = {
  id: string
  slug: string
  name: string
  domain: string
  discoveryMethod: DiscoveryMethod
  listingUrl: string
  sitemapChildPattern: string | null
  urlIncludePattern: string | null
  rateLimitMs: number
  maxItemsPerRun: number
  lookbackDays: number
}

// One discovered announcement. Sitemap and listing entries start without a
// title and are filled in from the page's own metadata only if they're new.
export type Candidate = {
  externalId: string
  url: string
  title: string
  publishedAt: Date | null
  excerpt: string
  needsMetadata: boolean
}

export type SourceContext = {
  fetchText: (url: string, accept?: string) => Promise<FetchedText>
  now: Date
}

const MAX_CHILD_SITEMAPS = 2
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Every request in a run goes through here: on-domain only, robots.txt
// respected, and spaced out by the source's rate limit.
export function createSourceContext(
  source: Pick<NewsSourceConfig, 'domain' | 'rateLimitMs'>,
  options: { fetchImpl?: typeof fetch; now?: Date; sleepImpl?: (ms: number) => Promise<unknown> } = {}
): SourceContext {
  const robotsByOrigin = new Map<string, Promise<RobotsPolicy>>()
  const wait = options.sleepImpl ?? sleep
  let lastRequestAt = 0

  async function paced(url: string, accept?: string) {
    const gap = Date.now() - lastRequestAt
    if (lastRequestAt > 0 && gap < source.rateLimitMs) await wait(source.rateLimitMs - gap)
    lastRequestAt = Date.now()
    return fetchSourceText(url, { domain: source.domain, accept, fetchImpl: options.fetchImpl })
  }

  async function robotsFor(origin: string) {
    let policy = robotsByOrigin.get(origin)
    if (!policy) {
      policy = paced(`${origin}/robots.txt`, 'text/plain')
        .then((response) => parseRobots(response.text))
        .catch((error: unknown) => {
          // No robots.txt means no restrictions. A server error means we can't
          // tell, so we stay away until the next run.
          if (error instanceof SourceFetchError && error.status && error.status >= 400 && error.status < 500) {
            return parseRobots('')
          }
          throw error
        })
      robotsByOrigin.set(origin, policy)
    }
    return policy
  }

  return {
    now: options.now ?? new Date(),
    async fetchText(url, accept) {
      const target = new URL(url)
      const policy = await robotsFor(target.origin)
      if (!isAllowedByRobots(policy, `${target.pathname}${target.search}`)) {
        throw new SourceFetchError(`robots.txt disallows ${target.pathname}`)
      }
      return paced(url, accept)
    },
  }
}

function isRecent(date: Date | null, source: NewsSourceConfig, now: Date) {
  if (!date) return true
  return now.getTime() - date.getTime() <= source.lookbackDays * 24 * 60 * 60 * 1000
}

function newestFirst<T extends { publishedAt: Date | null }>(items: T[]) {
  return [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
}

function matchesInclude(url: string, pattern: string | null) {
  return !pattern || new URL(url).pathname.includes(pattern)
}

async function collectFromFeed(source: NewsSourceConfig, context: SourceContext) {
  const feed = await context.fetchText(source.listingUrl)
  const candidates: Candidate[] = []
  let skipped = 0

  for (const entry of parseFeed(feed.text)) {
    const url = canonicalizeUrl(entry.link, source.domain, feed.url)
    if (!url || !entry.title) {
      skipped += 1
      continue
    }
    if (!isRecent(entry.publishedAt, source, context.now) || !matchesInclude(url, source.urlIncludePattern)) continue
    candidates.push({
      externalId: entry.externalId.slice(0, 500) || url,
      url,
      title: entry.title,
      publishedAt: entry.publishedAt,
      excerpt: entry.excerpt,
      needsMetadata: false,
    })
  }
  return { candidates: newestFirst(candidates).slice(0, source.maxItemsPerRun), skipped }
}

async function collectFromSitemap(source: NewsSourceConfig, context: SourceContext) {
  const root = await context.fetchText(source.listingUrl, 'application/xml, text/xml')
  let parsed = parseSitemap(root.text)
  let pageEntries = parsed.kind === 'urlset' ? parsed.entries : []

  if (parsed.kind === 'index') {
    // Only recently updated matching child sitemaps can hold new posts.
    const children = parsed.entries
      .filter((entry) => !source.sitemapChildPattern || entry.loc.includes(source.sitemapChildPattern))
      .filter((entry) => isRecent(entry.lastmod, source, context.now))
      .sort((a, b) => (b.lastmod?.getTime() ?? 0) - (a.lastmod?.getTime() ?? 0))
      .slice(0, MAX_CHILD_SITEMAPS)
    for (const child of children) {
      const childUrl = canonicalizeUrl(child.loc, source.domain, root.url)
      if (!childUrl) continue
      parsed = parseSitemap((await context.fetchText(childUrl, 'application/xml, text/xml')).text)
      if (parsed.kind === 'urlset') pageEntries = pageEntries.concat(parsed.entries)
    }
  }

  const candidates: Candidate[] = []
  let skipped = 0
  for (const entry of pageEntries) {
    const url = canonicalizeUrl(entry.loc, source.domain, root.url)
    if (!url) {
      skipped += 1
      continue
    }
    if (!matchesInclude(url, source.urlIncludePattern) || !isRecent(entry.lastmod, source, context.now)) continue
    candidates.push({ externalId: url, url, title: '', publishedAt: entry.lastmod, excerpt: '', needsMetadata: true })
  }
  return { candidates: newestFirst(candidates).slice(0, source.maxItemsPerRun), skipped }
}

// Listing pages and product-release pages: links on the page that match the
// source's include pattern, in page order (newest first on these pages).
async function collectFromListing(source: NewsSourceConfig, context: SourceContext) {
  const page = await context.fetchText(source.listingUrl, 'text/html')
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  const pageUrl = canonicalizeUrl(page.url, source.domain)

  // Off-site links are normal on a listing page, so they're ignored, not counted.
  for (const link of extractLinks(page.text, page.url)) {
    const url = canonicalizeUrl(link, source.domain)
    if (!url || seen.has(url) || url === pageUrl) continue
    if (!source.urlIncludePattern || !matchesInclude(url, source.urlIncludePattern)) continue
    seen.add(url)
    candidates.push({ externalId: url, url, title: '', publishedAt: null, excerpt: '', needsMetadata: true })
  }
  return { candidates: candidates.slice(0, source.maxItemsPerRun), skipped: 0 }
}

export async function collectCandidates(source: NewsSourceConfig, context: SourceContext) {
  switch (source.discoveryMethod) {
    case 'feed':
      return collectFromFeed(source, context)
    case 'sitemap':
      return collectFromSitemap(source, context)
    case 'html_listing':
    case 'release_page':
      return collectFromListing(source, context)
  }
}

// Fills in a new sitemap or listing entry from the page's own metadata.
// Returns null when the page turns out to be too old to count as news.
export async function enrichCandidate(
  source: NewsSourceConfig,
  candidate: Candidate,
  context: SourceContext
): Promise<Candidate | null> {
  const page = await context.fetchText(candidate.url, 'text/html')
  const meta = extractPageMeta(page.text)
  const canonical = meta.canonical ? canonicalizeUrl(meta.canonical, source.domain, page.url) : null
  const publishedAt = meta.publishedAt ?? candidate.publishedAt
  if (!isRecent(publishedAt, source, context.now)) return null

  return {
    ...candidate,
    url: canonical ?? candidate.url,
    title: meta.title || toPlainText(titleFromUrl(candidate.url), MAX_TITLE_LENGTH),
    publishedAt,
    excerpt: meta.description.slice(0, MAX_EXCERPT_LENGTH),
    needsMetadata: false,
  }
}
