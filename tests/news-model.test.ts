import test from 'node:test'
import assert from 'node:assert/strict'
import { isPublicNewsPath } from '../lib/news/public-path'
import {
  countWords,
  formatNewsAge,
  formatNewsDate,
  getNewsAvailability,
  getNewsSourceLabel,
  isValidNewsSlug,
  newsFeedHref,
  normalizeSourceUrl,
  parseNewsFilter,
  parseNewsPage,
  slugifyHeadline,
  splitParagraphs,
  validateNewsForPublish,
  type NewsDraftFields,
} from '../app/community/news/news-data'

const complete: NewsDraftFields = {
  headline: 'Vallejo announces new range',
  summary: 'A real summary.',
  category: 'paints',
  sourceName: 'Vallejo',
  sourceUrl: 'https://acrylicosvallejo.com/news',
  sourcePublishedAt: '2026-11-01',
  hasImage: false,
  imageRights: '',
}

test('only the news pages are public, never the Newsroom', () => {
  assert.equal(isPublicNewsPath('/community/news'), true)
  assert.equal(isPublicNewsPath('/community/news/a-story'), true)
  for (const path of [
    '/community',
    '/community/newsroom',
    '/community/newsroom/new',
    '/community/news-extra',
    '/community/events',
  ]) {
    assert.equal(isPublicNewsPath(path), false, path)
  }
})

test('availability separates scheduled from live', () => {
  const now = new Date('2026-11-06T12:00:00Z')
  assert.equal(getNewsAvailability({ status: 'draft', publishedAt: null }, now), 'draft')
  assert.equal(getNewsAvailability({ status: 'retracted', publishedAt: '2026-11-01T00:00:00Z' }, now), 'retracted')
  assert.equal(getNewsAvailability({ status: 'published', publishedAt: '2026-11-06T11:59:00Z' }, now), 'live')
  assert.equal(getNewsAvailability({ status: 'published', publishedAt: '2026-11-07T00:00:00Z' }, now), 'scheduled')
})

test('headlines become valid slugs', () => {
  assert.equal(slugifyHeadline("Citadel's New Paint Range: 40 Colours!"), 'citadels-new-paint-range-40-colours')
  assert.equal(slugifyHeadline('Pintura Acrílica'), 'pintura-acrilica')
  assert.equal(slugifyHeadline('!!!'), '')
  assert.equal(isValidNewsSlug(slugifyHeadline('x '.repeat(200))), true)
  for (const slug of ['', '-a', 'a-', 'A', 'a b', 'a--b', '../a']) {
    assert.equal(isValidNewsSlug(slug), false, slug)
  }
})

test('source links must be web addresses', () => {
  assert.equal(normalizeSourceUrl(' https://example.com/a '), 'https://example.com/a')
  for (const value of ['javascript:alert(1)', 'data:text/html,x', 'example.com', 'ftp://example.com', '']) {
    assert.equal(normalizeSourceUrl(value), null, value)
  }
})

test('industry news cannot publish without full attribution', () => {
  assert.equal(validateNewsForPublish(complete), null)
  assert.match(validateNewsForPublish({ ...complete, sourceName: '' }) ?? '', /source name/)
  assert.match(validateNewsForPublish({ ...complete, sourceUrl: '' }) ?? '', /source link/)
  assert.match(validateNewsForPublish({ ...complete, sourceUrl: 'javascript:x' }) ?? '', /http/)
  assert.match(validateNewsForPublish({ ...complete, sourcePublishedAt: '' }) ?? '', /announced/)
  assert.match(validateNewsForPublish({ ...complete, summary: ' ' }) ?? '', /summary/)
})

test('official announcements do not need an outside source', () => {
  assert.equal(
    validateNewsForPublish({
      ...complete,
      category: 'og_announcement',
      sourceName: '',
      sourceUrl: '',
      sourcePublishedAt: '',
    }),
    null
  )
})

test('an image cannot publish without stated rights', () => {
  assert.match(validateNewsForPublish({ ...complete, hasImage: true }) ?? '', /rights/)
  assert.equal(validateNewsForPublish({ ...complete, hasImage: true, imageRights: 'licensed' }), null)
})

test('feed parameters reject bad input', () => {
  assert.equal(parseNewsFilter('tools'), 'tools')
  assert.equal(parseNewsFilter('og_announcement'), null)
  assert.equal(parseNewsFilter(['tools']), null)
  assert.equal(parseNewsPage('3'), 3)
  for (const value of ['0', '-1', 'x', undefined, ['2']]) assert.equal(parseNewsPage(value), 1)
  assert.equal(parseNewsPage('999'), 50)
  assert.equal(newsFeedHref(null), '/community/news')
  assert.equal(newsFeedHref('tools', 2), '/community/news?category=tools&page=2')
})

test('dates and text helpers', () => {
  const now = new Date('2026-11-06T12:00:00Z')
  assert.equal(formatNewsAge('2026-11-06T11:30:00Z', now), 'Just now')
  assert.equal(formatNewsAge('2026-11-06T09:00:00Z', now), '3h ago')
  assert.equal(formatNewsAge('2026-11-05T09:00:00Z', now), 'Yesterday')
  assert.equal(formatNewsAge('2026-11-02T09:00:00Z', now), '4 days ago')
  assert.equal(formatNewsAge('2026-10-01T09:00:00Z', now), '1 Oct 2026')
  // A date-only source date must not shift a day by timezone.
  assert.equal(formatNewsDate('2026-11-01'), '1 Nov 2026')
  assert.equal(countWords('  one two\nthree '), 3)
  assert.deepEqual(splitParagraphs('a\n\n  b \n \nc'), ['a', 'b', 'c'])
  assert.equal(getNewsSourceLabel({ category: 'og_announcement', manufacturer: 'X', sourceName: 'Y' }), 'Obsidian Gallery')
  assert.equal(getNewsSourceLabel({ category: 'paints', manufacturer: null, sourceName: 'Y' }), 'Y')
})
