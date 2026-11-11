import { XMLParser } from 'fast-xml-parser'
import { decodeEntities, parseDate, toPlainText } from './text'

export type FeedEntry = {
  externalId: string
  link: string
  title: string
  publishedAt: Date | null
  excerpt: string
}

export type SitemapEntry = { loc: string; lastmod: Date | null }
export type ParsedSitemap = { kind: 'index' | 'urlset'; entries: SitemapEntry[] }

export const MAX_TITLE_LENGTH = 300
export const MAX_EXCERPT_LENGTH = 400

const ARRAY_TAGS = new Set(['item', 'entry', 'link', 'url', 'sitemap'])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => ARRAY_TAGS.has(name),
})

// Feeds never need a DOCTYPE, and dropping it rules out entity expansion tricks.
function parseXml(xml: string): Record<string, unknown> {
  const withoutDoctype = xml.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, '')
  const parsed = parser.parse(withoutDoctype)
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return value === undefined || value === null ? [] : [value]
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  const node = record(value)
  return typeof node['#text'] === 'string' ? node['#text'] : ''
}

function atomLink(links: unknown): string {
  const candidates = list(links).map(record)
  const preferred =
    candidates.find((link) => !link['@_rel'] || link['@_rel'] === 'alternate') ?? candidates[0]
  return typeof preferred?.['@_href'] === 'string' ? preferred['@_href'] : ''
}

export function parseFeed(xml: string): FeedEntry[] {
  const document = parseXml(xml)

  const rss = record(document.rss)
  if (Object.keys(rss).length > 0 || document['rdf:RDF']) {
    const channel = record(rss.channel)
    const items = list(channel.item ?? record(document['rdf:RDF']).item)
    return items.map(record).map((item) => {
      const link = decodeEntities(textOf(list(item.link)[0])).trim()
      return {
        externalId: (textOf(item.guid) || link).trim(),
        link,
        title: toPlainText(textOf(item.title), MAX_TITLE_LENGTH),
        publishedAt: parseDate(textOf(item.pubDate) || textOf(item['dc:date'])),
        excerpt: toPlainText(textOf(item.description) || textOf(item['content:encoded']), MAX_EXCERPT_LENGTH),
      }
    })
  }

  const feed = record(document.feed)
  return list(feed.entry)
    .map(record)
    .map((entry) => {
      const link = atomLink(entry.link).trim()
      return {
        externalId: (textOf(entry.id) || link).trim(),
        link,
        title: toPlainText(textOf(entry.title), MAX_TITLE_LENGTH),
        publishedAt: parseDate(textOf(entry.published) || textOf(entry.updated)),
        excerpt: toPlainText(textOf(entry.summary) || textOf(entry.content), MAX_EXCERPT_LENGTH),
      }
    })
}

export function parseSitemap(xml: string): ParsedSitemap {
  const document = parseXml(xml)
  const index = record(document.sitemapindex)
  const isIndex = Object.keys(index).length > 0
  const nodes = isIndex ? list(index.sitemap) : list(record(document.urlset).url)
  const entries = nodes
    .map(record)
    .map((node) => ({ loc: decodeEntities(textOf(node.loc)).trim(), lastmod: parseDate(textOf(node.lastmod)) }))
    .filter((entry) => entry.loc)
  return { kind: isIndex ? 'index' : 'urlset', entries }
}

export type PageMeta = {
  title: string
  description: string
  publishedAt: Date | null
  canonical: string
}

// Reads the standard metadata a page publishes about itself: Open Graph,
// article times and the canonical link. Only the <head> is looked at.
export function extractPageMeta(html: string): PageMeta {
  const headEnd = html.search(/<\/head>/i)
  const head = html.slice(0, headEnd > 0 ? headEnd : 300_000)
  const meta = new Map<string, string>()

  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag)
    if (key && content && !meta.has(key)) meta.set(key, content[1] ?? content[2] ?? '')
  }

  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ''
  const canonical =
    /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/i
      .exec(head)?.[0]
      .match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? ''

  return {
    title: toPlainText(meta.get('og:title') || meta.get('twitter:title') || titleTag, MAX_TITLE_LENGTH),
    description: toPlainText(
      meta.get('og:description') || meta.get('description') || meta.get('twitter:description'),
      MAX_EXCERPT_LENGTH
    ),
    publishedAt: parseDate(
      meta.get('article:published_time') || meta.get('datepublished') || meta.get('og:published_time')
    ),
    canonical: decodeEntities(canonical).trim(),
  }
}

// Links on a listing page, resolved against the page's address.
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) {
    try {
      links.push(new URL(decodeEntities(match[1]), baseUrl).toString())
    } catch {
      // Not a usable address.
    }
  }
  return links
}
