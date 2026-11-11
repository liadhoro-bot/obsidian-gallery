import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRelevance, contentFingerprint, isSameStory, titleTokens } from '../lib/news/ingest/classify'
import { collectCandidates, createSourceContext, enrichCandidate, type NewsSourceConfig } from '../lib/news/ingest/collect'
import { extractPageMeta, parseFeed, parseSitemap } from '../lib/news/ingest/parse'
import { isAllowedByRobots, parseRobots } from '../lib/news/ingest/robots'
import { fetchSourceText } from '../lib/news/ingest/safe-fetch'
import { describeIngestError, isSourceDue, runIsolated } from '../lib/news/ingest/schedule'
import { toPlainText } from '../lib/news/ingest/text'
import { canonicalizeUrl, parseSourceUrl } from '../lib/news/ingest/url'

const NOW = new Date('2026-11-11T12:00:00Z')

type Route = { status?: number; body?: string; headers?: Record<string, string> }

function mockFetch(routes: Record<string, Route>) {
  const calls: string[] = []
  const impl = (async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : input.toString()
    calls.push(url)
    const route = routes[url]
    if (!route) return new Response('not found', { status: 404 })
    return new Response(route.body ?? '', { status: route.status ?? 200, headers: route.headers })
  }) as typeof fetch
  return { impl, calls }
}

function source(overrides: Partial<NewsSourceConfig> = {}): NewsSourceConfig {
  return {
    id: 'source-1',
    slug: 'example',
    name: 'Example Paints',
    domain: 'example.com',
    discoveryMethod: 'feed',
    listingUrl: 'https://example.com/blogs/news.atom',
    sitemapChildPattern: null,
    urlIncludePattern: null,
    rateLimitMs: 500,
    maxItemsPerRun: 20,
    lookbackDays: 21,
    ...overrides,
  }
}

function context(fetchImpl: typeof fetch, domain = 'example.com') {
  return createSourceContext({ domain, rateLimitMs: 500 }, { fetchImpl, now: NOW, sleepImpl: async () => {} })
}

test('canonical URLs drop tracking, fragments and trailing slashes', () => {
  assert.equal(
    canonicalizeUrl('https://www.Example.com/news/tone-pro/?utm_source=x&b=2&a=1#top', 'example.com'),
    'https://www.example.com/news/tone-pro?a=1&b=2'
  )
  assert.equal(canonicalizeUrl('/blogs/explore/new-paints', 'example.com', 'https://example.com/feed'), 'https://example.com/blogs/explore/new-paints')
})

test('only HTTPS addresses on the source domain are accepted', () => {
  assert.equal(parseSourceUrl('http://example.com/a', 'example.com'), null)
  assert.equal(parseSourceUrl('https://evil.com/a', 'example.com'), null)
  assert.equal(parseSourceUrl('https://example.com.evil.com/a', 'example.com'), null)
  assert.equal(parseSourceUrl('https://user:pass@example.com/a', 'example.com'), null)
  assert.equal(parseSourceUrl('https://example.com:8443/a', 'example.com'), null)
  assert.equal(parseSourceUrl('https://127.0.0.1/a', '127.0.0.1'), null)
  assert.equal(parseSourceUrl('https://localhost/a', 'localhost'), null)
  assert.ok(parseSourceUrl('https://www.example.com/a', 'example.com'))
})

test('robots.txt: AI-bot groups do not apply to us, * rules do', () => {
  const policy = parseRobots(
    ['User-Agent: *', 'Allow: /', 'Disallow: /private/', '', 'User-Agent: GPTBot', 'User-Agent: ClaudeBot', 'Disallow: /'].join('\n')
  )
  assert.equal(isAllowedByRobots(policy, '/en-gb/articles/abc/'), true)
  assert.equal(isAllowedByRobots(policy, '/private/x'), false)
})

test('robots.txt: a group naming our bot wins, with wildcards and $', () => {
  const policy = parseRobots(
    ['User-agent: *', 'Disallow:', '', 'User-agent: ObsidianGalleryNewsBot', 'Disallow: /*.pdf$', 'Disallow: /drafts', 'Allow: /drafts/public'].join('\n')
  )
  assert.equal(isAllowedByRobots(policy, '/files/a.pdf'), false)
  assert.equal(isAllowedByRobots(policy, '/files/a.pdf?x=1'), true)
  assert.equal(isAllowedByRobots(policy, '/drafts/secret'), false)
  assert.equal(isAllowedByRobots(policy, '/drafts/public/one'), true)
  assert.equal(isAllowedByRobots(parseRobots(''), '/anything'), true)
})

test('Atom and RSS feeds parse to plain-text entries', () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry><id>tag:example.com,2026:1</id><title type="html">New &amp;amp; improved paints</title>
      <link rel="alternate" href="https://example.com/blogs/news/new-paints"/>
      <published>2026-11-10T09:00:00Z</published>
      <summary type="html">&lt;p&gt;Twelve &lt;b&gt;new&lt;/b&gt; colours&lt;script&gt;alert(1)&lt;/script&gt;&lt;/p&gt;</summary></entry></feed>`
  const [entry] = parseFeed(atom)
  assert.equal(entry.title, 'New & improved paints')
  assert.equal(entry.link, 'https://example.com/blogs/news/new-paints')
  assert.equal(entry.externalId, 'tag:example.com,2026:1')
  assert.equal(entry.excerpt, 'Twelve new colours')
  assert.equal(entry.publishedAt?.toISOString(), '2026-11-10T09:00:00.000Z')

  const rss = `<rss version="2.0"><channel><item><title><![CDATA[Pre-orders: the new starter set]]></title>
    <link>https://example.com/news/starter-set/</link><guid isPermaLink="false">123</guid>
    <pubDate>Tue, 10 Nov 2026 08:00:00 +0000</pubDate><description>Out &#8216;now&#8217;</description></item></channel></rss>`
  const [item] = parseFeed(rss)
  assert.equal(item.title, 'Pre-orders: the new starter set')
  assert.equal(item.externalId, '123')
  assert.equal(item.excerpt, 'Out ‘now’')
})

test('a DOCTYPE with entity definitions is ignored', () => {
  const xml = `<?xml version="1.0"?><!DOCTYPE feed [<!ENTITY x "BOOM">]><feed><entry><id>1</id><title>&x;Title</title><link href="https://example.com/a"/></entry></feed>`
  const [entry] = parseFeed(xml)
  assert.ok(!entry.title.includes('BOOM'))
})

test('sitemaps parse as an index or a URL set', () => {
  const index = parseSitemap(`<sitemapindex><sitemap><loc>https://example.com/post-sitemap.xml</loc><lastmod>2026-11-01</lastmod></sitemap></sitemapindex>`)
  assert.equal(index.kind, 'index')
  assert.equal(index.entries[0].loc, 'https://example.com/post-sitemap.xml')
  const set = parseSitemap(`<urlset><url><loc>https://example.com/news/a/</loc><lastmod>2026-11-10T10:00:00+00:00</lastmod></url></urlset>`)
  assert.equal(set.kind, 'urlset')
  assert.equal(set.entries[0].lastmod?.toISOString(), '2026-11-10T10:00:00.000Z')
})

test('page metadata comes from Open Graph and the canonical link', () => {
  const meta = extractPageMeta(`<html><head><title>Fallback</title>
    <meta property="og:title" content="Battlegrounds are here &amp; ready" />
    <meta name="description" content="Short description" />
    <meta property="article:published_time" content="2026-11-09T13:37:17+00:00" />
    <link rel="canonical" href="https://www.example.com/news/battlegrounds/" /></head><body><meta property="og:title" content="Body"></body></html>`)
  assert.equal(meta.title, 'Battlegrounds are here & ready')
  assert.equal(meta.description, 'Short description')
  assert.equal(meta.publishedAt?.toISOString(), '2026-11-09T13:37:17.000Z')
  assert.equal(meta.canonical, 'https://www.example.com/news/battlegrounds/')
})

test('plain text is stripped, decoded and capped', () => {
  assert.equal(toPlainText('<p>a&nbsp;&amp;&nbsp;b</p>', 50), 'a & b')
  assert.ok(toPlainText('word '.repeat(200), 40).length <= 40)
  assert.equal(toPlainText('<p><strong>O</strong>ur <a href="/x">new</a> range</p><p>Next</p>', 80), 'Our new range Next')
})

test('relevance favours release news over tutorials and notices', () => {
  assert.equal(classifyRelevance('Saturday Pre-orders – Warhammer Tone Pro is here', '150 new paints').relevance, 'relevant')
  assert.equal(classifyRelevance('Scam Alert - Watch Out!', '').relevance, 'irrelevant')
  assert.equal(classifyRelevance('How Do You Get a Smooth Blend When Painting Miniatures?', '').relevance, 'irrelevant')
  assert.equal(classifyRelevance('The Quar are Coming!', 'A new plastic kit').relevance !== 'irrelevant', true)
})

test('stories group by shared title words; fingerprints are stable', () => {
  assert.equal(
    isSameStory(titleTokens('Warhammer Tone Pro paints: pre-orders open Saturday'), titleTokens('Pre-orders open Saturday for Warhammer Tone Pro paints')),
    true
  )
  assert.equal(isSameStory(titleTokens('New Necron kits revealed'), titleTokens('New Vallejo paint set revealed')), false)
  const date = new Date('2026-11-10T09:00:00Z')
  assert.equal(contentFingerprint('Tone Pro is here', date, 'https://a'), contentFingerprint('Tone pro IS here!', date, 'https://b'))
})

test('fetches refuse off-domain redirects and oversized responses', async () => {
  const offSite = mockFetch({
    'https://example.com/feed': { status: 302, headers: { location: 'https://169.254.169.254/latest' } },
  })
  await assert.rejects(fetchSourceText('https://example.com/feed', { domain: 'example.com', fetchImpl: offSite.impl }), /outside example\.com/)

  const sameSite = mockFetch({
    'https://example.com/feed': { status: 301, headers: { location: '/feed.xml' } },
    'https://example.com/feed.xml': { body: '<rss/>' },
  })
  const result = await fetchSourceText('https://example.com/feed', { domain: 'example.com', fetchImpl: sameSite.impl })
  assert.equal(result.url, 'https://example.com/feed.xml')

  const huge = mockFetch({ 'https://example.com/feed': { body: 'x'.repeat(2048) } })
  await assert.rejects(
    fetchSourceText('https://example.com/feed', { domain: 'example.com', maxBytes: 1024, fetchImpl: huge.impl }),
    /too large/
  )
})

test('feed sources keep recent on-domain entries, newest first', async () => {
  const feed = `<feed><entry><id>old</id><title>Old paint release</title><link href="https://example.com/blogs/news/old"/><published>2026-09-01T00:00:00Z</published></entry>
    <entry><id>offsite</id><title>Elsewhere</title><link href="https://other.com/x"/><published>2026-11-10T00:00:00Z</published></entry>
    <entry><id>a</id><title>New paints</title><link href="https://example.com/blogs/news/a?utm_medium=rss"/><published>2026-11-09T00:00:00Z</published></entry>
    <entry><id>b</id><title>New brushes</title><link href="https://example.com/blogs/news/b"/><published>2026-11-10T00:00:00Z</published></entry></feed>`
  const { impl } = mockFetch({ 'https://example.com/blogs/news.atom': { body: feed } })
  const { candidates, skipped } = await collectCandidates(source(), context(impl))
  assert.deepEqual(candidates.map((candidate) => candidate.externalId), ['b', 'a'])
  assert.equal(candidates[1].url, 'https://example.com/blogs/news/a')
  assert.equal(skipped, 1)
})

test('robots.txt is honoured before any page is fetched', async () => {
  const { impl, calls } = mockFetch({
    'https://example.com/robots.txt': { body: 'User-agent: *\nDisallow: /blogs/' },
    'https://example.com/blogs/news.atom': { body: '<feed/>' },
  })
  await assert.rejects(collectCandidates(source(), context(impl)), /robots\.txt disallows/)
  assert.deepEqual(calls, ['https://example.com/robots.txt'])
})

test('sitemap sources pick the newest matching child and fill titles from the page', async () => {
  const { impl } = mockFetch({
    'https://www.example.com/sitemap_index.xml': {
      body: `<sitemapindex><sitemap><loc>https://www.example.com/post-sitemap.xml</loc><lastmod>2026-01-01</lastmod></sitemap>
        <sitemap><loc>https://www.example.com/post-sitemap2.xml</loc><lastmod>2026-11-10</lastmod></sitemap>
        <sitemap><loc>https://www.example.com/product-sitemap.xml</loc><lastmod>2026-11-11</lastmod></sitemap></sitemapindex>`,
    },
    'https://www.example.com/post-sitemap2.xml': {
      body: `<urlset><url><loc>https://www.example.com/news/new-kit/</loc><lastmod>2026-11-10T10:00:00Z</lastmod></url>
        <url><loc>https://www.example.com/about/</loc><lastmod>2026-11-10T10:00:00Z</lastmod></url></urlset>`,
    },
    'https://www.example.com/news/new-kit': {
      body: '<head><meta property="og:title" content="New plastic kit revealed"><meta property="article:published_time" content="2026-11-09T08:00:00Z"></head>',
    },
  })
  const config = source({
    discoveryMethod: 'sitemap',
    listingUrl: 'https://www.example.com/sitemap_index.xml',
    sitemapChildPattern: 'post-sitemap',
    urlIncludePattern: '/news/',
  })
  const ctx = context(impl)
  const { candidates } = await collectCandidates(config, ctx)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].needsMetadata, true)
  const enriched = await enrichCandidate(config, candidates[0], ctx)
  assert.equal(enriched?.title, 'New plastic kit revealed')
  assert.equal(enriched?.publishedAt?.toISOString(), '2026-11-09T08:00:00.000Z')
})

test('one failing source does not stop the others', async () => {
  const results = await runIsolated(
    ['a', 'broken', 'c'],
    async (name) => {
      if (name === 'broken') throw new Error('boom')
      return `${name}: ok`
    },
    (name, error) => `${name}: ${describeIngestError(error)}`
  )
  assert.deepEqual(results, ['a: ok', 'broken: Unexpected error: boom', 'c: ok'])
})

test('sources are due after their interval, with backoff after failures', () => {
  const lastAttempt = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString()
  assert.equal(isSourceDue({ last_attempt_at: null, poll_interval_minutes: 180, consecutive_failures: 0 }, NOW), true)
  assert.equal(isSourceDue({ last_attempt_at: lastAttempt, poll_interval_minutes: 180, consecutive_failures: 0 }, NOW), true)
  assert.equal(isSourceDue({ last_attempt_at: lastAttempt, poll_interval_minutes: 180, consecutive_failures: 1 }, NOW), false)
})
