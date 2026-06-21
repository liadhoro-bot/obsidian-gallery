const EMPTY_PATTERN = /^\s*$/

const COMMON_WORDS = new Set([
  'paint',
  'paints',
  'color',
  'colors',
  'colour',
  'colours',
  'acrylic',
  'acrylics',
])

const LINE_COMMON_WORDS = new Set(['paint', 'paints', 'acrylic', 'acrylics'])

const BRAND_ALIASES: Array<[RegExp, string]> = [
  [
    /\b(games workshop|gw|warhammer colour|warhammer color|citadel colour|citadel color|citadel)\b/g,
    'citadel',
  ],
  [/\bvallejo\b|\bacrylicos vallejo\b|\bav\b/g, 'vallejo'],
  [/\b(the army painter|army painter|tap|warpaints?)\b/g, 'army painter'],
  [/\bak interactive\b|\bak 3rd gen\b|\bak third gen\b|\bak\b/g, 'ak'],
  [/\bpro acryl\b|\bmonument hobbies\b|\bmonument\b/g, 'pro acryl'],
  [/\bprivateer press\b|\bformula p3\b|\bp3 formula\b|\bp3\b|\bsfg\b/g, 'p3'],
  [/\bgreen stuff world\b|\bgreenstuffworld\b|\bgsw\b/g, 'green stuff world'],
]

const LINE_ALIASES: Array<[RegExp, string]> = [
  [
    /\bvallejo model color\b|\bvallejo model colour\b|\bmodel color\b|\bmodel colour\b|\bvallejo model\b|\bvmc\b/g,
    'model color',
  ],
  [
    /\bvallejo game color\b|\bvallejo game colour\b|\bgame color\b|\bgame colour\b|\bvallejo game\b|\bvgc\b/g,
    'game color',
  ],
  [/\bmodel air\b|\bvma\b/g, 'model air'],
  [/\bgame air\b|\bvga\b/g, 'game air'],
  [/\bmetal color\b|\bmetal colour\b/g, 'metal color'],
  [/\bcitadel base\b|\bbase\b/g, 'base'],
  [/\bcitadel layer\b|\blayer\b/g, 'layer'],
  [/\bcitadel shade\b|\bshade\b|\bwash\b/g, 'shade'],
  [/\bcitadel contrast\b|\bcontrast\b/g, 'contrast'],
  [/\bspeedpaint\b|\bspeed paint\b/g, 'speedpaint'],
  [/\bxpress color\b|\bxpress colour\b|\bxpress\b/g, 'xpress'],
  [/\bwarpaints fanatic\b|\bfanatic\b/g, 'warpaints fanatic'],
  [/\bwarpaints air\b/g, 'warpaints air'],
  [/\bthird generation\b|\b3rd generation\b|\b3rd gen\b/g, '3rd gen'],
  [/\bp3 formula\b|\bformula p3\b/g, 'p3'],
]

function normalizeWhitespace(input: string) {
  return input.trim().replace(/\s+/g, ' ')
}

function removeSafePunctuation(input: string) {
  return input
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,:;!?_/\\|-]/g, ' ')
}

function normalizeBase(input: string) {
  return normalizeWhitespace(removeSafePunctuation(input.toLowerCase()))
}

function applyAliases(input: string, aliases: Array<[RegExp, string]>) {
  let normalized = input

  for (const [pattern, replacement] of aliases) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalizeWhitespace(normalized)
}

function removeCommonWords(input: string, commonWords = COMMON_WORDS) {
  return normalizeWhitespace(
    input
      .split(' ')
      .filter((token) => token && !commonWords.has(token))
      .join(' ')
  )
}

export function normalizeBrand(input: string) {
  if (EMPTY_PATTERN.test(input)) return ''

  return applyAliases(normalizeBase(input), BRAND_ALIASES)
}

export function normalizeLine(input: string) {
  if (EMPTY_PATTERN.test(input)) return ''

  return removeCommonWords(
    applyAliases(normalizeBase(input), LINE_ALIASES),
    LINE_COMMON_WORDS
  )
}

export function normalizePaintName(input: string) {
  if (EMPTY_PATTERN.test(input)) return ''

  return removeCommonWords(normalizeBase(input))
}

export function normalizePaintCode(input: string): string | null {
  if (EMPTY_PATTERN.test(input)) return null

  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/sku|code|ref|no\./g, ' ')
    .replace(/[^a-z0-9]/g, '')

  return normalized || null
}

export function buildNormalizedPaintKey({
  brand,
  line,
  name,
}: {
  brand?: string | null
  line?: string | null
  name?: string | null
}) {
  return [brand, line, name].filter(Boolean).join('|')
}
