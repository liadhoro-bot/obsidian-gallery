import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyRelevance } from '../lib/news/ingest/classify'
import { collectCandidates, createSourceContext, type NewsSourceConfig } from '../lib/news/ingest/collect'
import { parseYouTubeVideoId } from '../app/community/news/news-data'
import { buildDigest, type ClusterMember, type InboxItem } from '../app/community/newsroom/inbox-digest'

const NOW = new Date('2026-11-21T12:00:00Z')
const CHANNEL = 'UCm4UYMFMVFKtZBi9uk4HSCg'

const youtubeSource: NewsSourceConfig = {
  id: 'yt',
  slug: 'warhammer-youtube',
  name: 'Warhammer (YouTube)',
  domain: 'youtube.com',
  discoveryMethod: 'youtube',
  listingUrl: 'https://www.youtube.com/@officialwarhammer',
  sitemapChildPattern: null,
  urlIncludePattern: null,
  youtubeChannelId: CHANNEL,
  contentReuse: 'link_and_summary',
  rateLimitMs: 500,
  maxItemsPerRun: 15,
  lookbackDays: 7,
}

function playlistItem(videoId: string, title: string, publishedAt: string) {
  return {
    snippet: {
      title,
      description: `<b>${title}</b> description`,
      publishedAt,
      resourceId: { videoId },
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` } },
    },
  }
}

test('YouTube sources read the uploads playlist through the Data API', async () => {
  const calls: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    calls.push(url.toString())
    assert.equal(url.hostname, 'www.googleapis.com')
    assert.equal(url.searchParams.get('playlistId'), `UU${CHANNEL.slice(2)}`)
    assert.equal(url.searchParams.get('key'), 'test-key')
    return new Response(
      JSON.stringify({
        items: [
          playlistItem('AAAAAAAAAAA', 'Big News for Blood Angels', '2026-11-20T17:00:00Z'),
          playlistItem('BBBBBBBBBBB', 'Private video', '2026-11-20T10:00:00Z'),
          playlistItem('CCCCCCCCCCC', 'Old trailer', '2026-10-01T10:00:00Z'),
          playlistItem('bad id', 'Broken', '2026-11-20T10:00:00Z'),
        ],
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  }) as typeof fetch

  const context = createSourceContext(youtubeSource, { fetchImpl, now: NOW, youtubeApiKey: 'test-key' })
  const { candidates, skipped } = await collectCandidates(youtubeSource, context)
  assert.equal(calls.length, 1, 'one API call, no robots.txt or page fetches')
  assert.equal(skipped, 2)
  assert.deepEqual(
    candidates.map((candidate) => [candidate.externalId, candidate.url, candidate.title, candidate.videoId]),
    [['youtube:AAAAAAAAAAA', 'https://www.youtube.com/watch?v=AAAAAAAAAAA', 'Big News for Blood Angels', 'AAAAAAAAAAA']]
  )
  assert.equal(candidates[0].thumbnailUrl, 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg')
  assert.equal(candidates[0].excerpt, 'Big News for Blood Angels description')
})

test('YouTube sources fail clearly without an API key, and never leak it', async () => {
  const noKey = createSourceContext(youtubeSource, {
    now: NOW,
    fetchImpl: (async () => new Response('')) as typeof fetch,
  })
  await assert.rejects(collectCandidates(youtubeSource, noKey), /YOUTUBE_API_KEY is not set/)

  const forbidden = (async () => new Response('{}', { status: 403 })) as typeof fetch
  const withKey = createSourceContext(youtubeSource, { now: NOW, fetchImpl: forbidden, youtubeApiKey: 'secret-key-123' })
  await assert.rejects(collectCandidates(youtubeSource, withKey), (error: Error) => {
    assert.ok(!error.message.includes('secret-key-123'))
    return /HTTP 403/.test(error.message)
  })
})

test('blog triage drops lists, explainers, rumours and toys', () => {
  for (const title of [
    'Grimdark Armylist: Space Wolves California Cup Winning List',
    '40k Core Stratagems and Reserves Rules Explained',
    'Plastic Warhound Titan, GW Price Cut, 40k Primarch Rumors Now',
    'LEGO Warhammer 40k: Make, Build, & Buy Your Favorites',
    'Age of Sigmar: How to Play Seraphon',
  ]) {
    assert.equal(classifyRelevance(title, '').relevance, 'irrelevant', title)
  }
  assert.equal(classifyRelevance('AoS Khazalite Holds Nov 21st Pre-Orders: Available Now', '').relevance, 'relevant')
})

test('YouTube links of every common shape give the video id', () => {
  const id = 'dQw4w9WgXcQ'
  for (const link of [
    id,
    `https://www.youtube.com/watch?v=${id}&t=10s`,
    `https://youtu.be/${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) {
    assert.equal(parseYouTubeVideoId(link), id, link)
  }
  for (const bad of ['https://vimeo.com/123', `https://evil.example/watch?v=${id}`, 'not a link', 'javascript:alert(1)']) {
    assert.equal(parseYouTubeVideoId(bad), null, bad)
  }
})

function item(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: 'x',
    title: 'Story',
    url: 'https://example.com/story',
    publishedAt: '2026-11-21T08:00:00Z',
    discoveredAt: '2026-11-21T09:00:00Z',
    excerpt: null,
    relevance: 'maybe',
    reasons: [],
    state: 'new',
    sourceName: 'Example',
    isTip: false,
    thumbnailUrl: null,
    videoId: null,
    alsoReportedBy: [],
    articleId: null,
    ...overrides,
  }
}

test('the digest shows one card per story, borrowing the official video and description', () => {
  const thumb = 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg'
  const tip = item({
    id: 'tip',
    title: 'Blood Angels get new kits',
    isTip: true,
    relevance: 'relevant',
    sourceName: 'Spikey Bits',
    alsoReportedBy: ['Warhammer (YouTube)'],
  })
  const official = item({
    id: 'yt',
    title: 'Big News for Blood Angels',
    sourceName: 'Warhammer (YouTube)',
    excerpt: 'Official description',
    thumbnailUrl: thumb,
    videoId: 'AAAAAAAAAAA',
    alsoReportedBy: ['Spikey Bits'],
  })
  const other = item({ id: 'other', title: 'New paint range' })
  const members = new Map<string, ClusterMember[]>([
    [
      'c1',
      [
        {
          id: 'tip',
          cluster_id: 'c1',
          evidence_excerpt: null,
          video_id: null,
          thumbnail_url: null,
          news_sources: { name: 'Spikey Bits', content_reuse: 'link_only' },
        },
        {
          id: 'yt',
          cluster_id: 'c1',
          evidence_excerpt: 'Official description',
          video_id: 'AAAAAAAAAAA',
          thumbnail_url: thumb,
          news_sources: { name: 'Warhammer (YouTube)', content_reuse: 'link_and_summary' },
        },
      ],
    ],
  ])
  const clusterOf = new Map<string, string | null>([
    ['tip', 'c1'],
    ['yt', 'c1'],
    ['other', null],
  ])

  const digest = buildDigest([tip, official, other], members, clusterOf)
  assert.equal(digest.length, 2, 'the two reports of one story share a card')
  const lead = digest[0]
  assert.equal(lead.excerpt, 'Official description')
  assert.equal(lead.videoId, 'AAAAAAAAAAA')
  assert.equal(lead.thumbnailUrl, thumb)
  assert.equal(digest[1].id, 'other')
})

test('a short official headline groups with a longer blog headline, recurring columns do not', async () => {
  const { isSameStory, titleTokens } = await import('../lib/news/ingest/classify')
  assert.ok(
    isSameStory(
      titleTokens('A First Look at Kings of War: Arrogance'),
      titleTokens('Kings of War: Arrogance New Rules, Army Updates & Minis For Pannithor')
    )
  )
  assert.ok(
    !isSameStory(titleTokens('Warhammer Next Week: New Seraphon'), titleTokens('Warhammer Next Week: New Orruks'))
  )
  assert.ok(
    !isSameStory(
      titleTokens('Games Workshop Pre-Orders: Skeletons and Goblins Go Bump in the Night'),
      titleTokens('Tomb Kings Battle March Army, Blood Bowl Pre-Orders Live Worldwide')
    )
  )
})
