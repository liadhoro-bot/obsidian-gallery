import test from 'node:test'
import assert from 'node:assert/strict'
import { detectGameSystem } from '../lib/news/game-systems'
import { isMatchingVideo, searchOfficialVideo, videoSearchQuery } from '../lib/news/ingest/match-video'
import { createSourceContext } from '../lib/news/ingest/collect'

test('headlines map to the right game, maker and channel', () => {
  const cases: Array<[string, string | null, string | null]> = [
    ['Tomb Kings Battle March Army, Blood Bowl Pre-Orders Live Worldwide', 'old-world', 'warhammer-youtube'],
    ['Kill Team: Hivestorm Pre-Orders This Weekend', 'kill-team', 'warhammer-youtube'],
    ['AoS Khazalite Holds Nov 21st Pre-Orders: Available Now', 'age-of-sigmar', 'warhammer-youtube'],
    ['New Seraphon Revealed', 'age-of-sigmar', 'warhammer-youtube'],
    ["Big News for Blood Angels", '40k', 'warhammer-youtube'],
    ["T'au Empire Codex Rules Leak", '40k', 'warhammer-youtube'],
    ['Kings of War: Arrogance New Rules, Army Updates & Minis For Pannithor', 'kings-of-war', 'mantic-games-youtube'],
    ['Speedpaint 2.0 Mega Set Arrives', 'army-painter', 'the-army-painter-youtube'],
    ['Pro Acryl Expansion Set 4', 'monument', 'monument-hobbies-youtube'],
    ['Trench Crusade Gets A New Faction', 'trench-crusade', null],
    ['New Bretonnian Models for WH TOW', 'old-world', 'warhammer-youtube'],
  ]
  for (const [headline, id, channel] of cases) {
    const system = detectGameSystem(headline)
    assert.equal(system?.id ?? null, id, headline)
    assert.equal(system?.channelSlug ?? null, channel, headline)
  }
  assert.equal(detectGameSystem('A lovely new hobby desk lamp'), null)
  // Words inside other words don't count ("aos" in "chaos" is a separate word only).
  assert.equal(detectGameSystem('Chaos reigns in the paint aisle'), null)
})

test('a video counts as the same story only when distinctive words match', () => {
  assert.ok(isMatchingVideo('Khazalite Holds Pre-Orders: Available Now', 'Khazalite Holds – Official Trailer'))
  assert.ok(isMatchingVideo('Tomb Kings Battle March Army Pre-Orders', 'Tomb Kings of Khemri: Battle March Unboxing'))
  assert.ok(!isMatchingVideo('Tomb Kings Battle March Army Pre-Orders', 'Warhammer Preview: Next Week'))
  assert.ok(!isMatchingVideo('New Seraphon Revealed', 'Seraphon Painting Tutorial'), 'one shared word is not enough')
  assert.equal(videoSearchQuery('Warhammer 40k Pre-Orders: New Blood Angels Kits Revealed'), 'blood angels')
})

test('the official channel search returns the first matching video and spends one call', async () => {
  const calls: URL[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    calls.push(url)
    return new Response(
      JSON.stringify({
        items: [
          { id: { videoId: 'AAAAAAAAAAA' }, snippet: { title: 'Warhammer Preview: Next Week', publishedAt: '2026-11-20T10:00:00Z' } },
          {
            id: { videoId: 'BBBBBBBBBBB' },
            snippet: {
              title: 'Khazalite Holds &#8211; Official Trailer',
              description: 'Duardin &amp; their holds',
              publishedAt: '2026-11-19T10:00:00Z',
              thumbnails: { high: { url: 'https://i.ytimg.com/vi/BBBBBBBBBBB/hqdefault.jpg' } },
            },
          },
        ],
      }),
      { headers: { 'content-type': 'application/json' } }
    )
  }) as typeof fetch

  const context = createSourceContext(
    { domain: 'youtube.com', rateLimitMs: 0 },
    { fetchImpl, youtubeApiKey: 'k', now: new Date('2026-11-24T12:00:00Z') }
  )
  const video = await searchOfficialVideo(
    context,
    'UCm4UYMFMVFKtZBi9uk4HSCg',
    'AoS Khazalite Holds Nov 21st Pre-Orders: Available Now',
    new Date('2026-11-21T08:00:00Z')
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].pathname, '/youtube/v3/search')
  assert.equal(calls[0].searchParams.get('channelId'), 'UCm4UYMFMVFKtZBi9uk4HSCg')
  assert.equal(calls[0].searchParams.get('type'), 'video')
  assert.equal(video?.videoId, 'BBBBBBBBBBB')
  assert.equal(video?.title, 'Khazalite Holds – Official Trailer')
  assert.equal(video?.excerpt, 'Duardin & their holds')
  assert.equal(video?.thumbnailUrl, 'https://i.ytimg.com/vi/BBBBBBBBBBB/hqdefault.jpg')
})
