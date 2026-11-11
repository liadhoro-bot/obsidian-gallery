// Turns untrusted source markup into short plain text. Nothing collected is
// ever rendered as HTML; React escapes it, and these helpers keep it small.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  raquo: '»',
  laquo: '«',
  trade: '™',
  reg: '®',
  copy: '©',
}

export function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

export function stripTags(value: string) {
  return value
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Inline tags can split a word ("<strong>O</strong>ur"), so they leave no gap.
    .replace(/<\/?(a|abbr|b|bdi|bdo|cite|code|em|i|mark|q|s|small|span|strong|sub|sup|u)\b[^>]*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
}

export function toPlainText(value: unknown, maxLength: number) {
  if (typeof value !== 'string' || !value) return ''
  // Feeds often carry escaped HTML, so decode, strip, then decode what's left.
  const text = decodeEntities(stripTags(decodeEntities(value)))
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value.trim())
  return Number.isNaN(date.getTime()) ? null : date
}

// Last resort for pages without a title: "warpath-universe-round-up" → "Warpath universe round up".
export function titleFromUrl(url: string) {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? ''
    const words = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim()
    return words ? words[0].toUpperCase() + words.slice(1) : ''
  } catch {
    return ''
  }
}
