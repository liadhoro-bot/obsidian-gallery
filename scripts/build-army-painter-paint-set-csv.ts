import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type ShopifyProduct = {
  title: string
  handle: string
  body_html?: string
  tags?: string[]
  variants?: { sku?: string }[]
}

type CatalogPaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
}

type ResolvedItem = {
  sourceName: string
  itemRole: string
  paint: CatalogPaint
}

type ExtractedItem = {
  rawName: string
  prefix: string
  itemName: string
  itemLine: string
  itemRole: string
  paint: CatalogPaint | null
}

type ReviewEntry = {
  productCode: string
  title: string
  sourceUrl: string
  status: 'imported' | 'skipped'
  reason?: string
  extractedItems?: string[]
  unresolvedItems?: string[]
  nonVaultHints?: string[]
  importedItems?: number
}

type ManualSetItem = {
  name: string
  line: string
  role: string
}

const BRAND = 'Army Painter'
const MANUFACTURER = 'The Army Painter'
const SOURCE_COLLECTIONS = [
  {
    label: 'bundles-product-sets',
    url: 'https://thearmypainter.com/collections/bundles-product-sets/products.json?limit=250',
    file: path.join(
      process.cwd(),
      'downloads',
      'reference',
      'army-painter-bundles-product-sets.json'
    ),
    tempFile: path.join(process.env.TEMP ?? '', 'army-painter-bundles-product-sets.json'),
  },
  {
    label: 'all-paint-sets',
    url: 'https://thearmypainter.com/collections/all-paint-sets/products.json?limit=250',
    file: path.join(
      process.cwd(),
      'downloads',
      'reference',
      'army-painter-all-paint-sets.json'
    ),
    tempFile: path.join(process.env.TEMP ?? '', 'army-painter-paint-sets.json'),
  },
  {
    label: 'flexible-triads',
    url: 'https://thearmypainter.com/collections/flexible-triads/products.json?limit=250',
    file: path.join(
      process.cwd(),
      'downloads',
      'reference',
      'army-painter-flexible-triads.json'
    ),
    tempFile: path.join(process.env.TEMP ?? '', 'army-painter-flexible-triads.json'),
  },
]

const SOURCE_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-sets.csv'
)
const SET_COVERAGE_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-set-coverage.csv'
)
const CATALOG_GAPS_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-catalog-gaps.csv'
)
const MISSING_PAINT_DATASET_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-missing-paints-paint-dataset.csv'
)
const MISSING_PAINT_REPORT_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-missing-paints-report.csv'
)
const IMPORT_CLEAN_CSV = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-sets-import-clean.csv'
)
const REVIEW_JSON = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-sets-review.json'
)

const VAULT_LINES = new Set(['Speedpaint', 'Warpaints Fanatic'])
const NON_VAULT_PREFIXES = [
  'Warpaints Air',
  'Colour Primer',
  'Historical',
  'Battlefields',
  'Wargamer',
  'Brush',
  'Hobby',
]
const ITEM_PREFIXES = [
  'John Blanche Masterclass',
  'John Blanche',
  'Masterclass',
  'Warpaints Fanatic Effects',
  'Warpaints Fanatic Metallic',
  'Warpaints Fanatic Wash',
  'Warpaints Fanatic',
  'Warpaints Air',
  'Speedpaint Markers',
  'Speedpaint',
  'Historical',
  'Colour Primer',
]
const STOP_LIST_PATTERNS = [
  /^$/,
  /^\d+\s*x?\s*\d*\s*ml/i,
  /^\d+\s+replacement\b/i,
  /^painting guide\b/i,
  /^care booklet\b/i,
  /^free\b/i,
  /^pre-loaded\b/i,
  /^buy the bundle\b/i,
  /^follow\b/i,
  /^\d+\s+(?:acrylic|metallic|quickshade|effects?)\s+warpaints?/i,
  /^\d+\s+warpaints?:?$/i,
  /^contents:?$/i,
  /^includes:?$/i,
  /^and\b/i,
  /^all\b/i,
]
const MANUAL_SET_ITEMS = new Map<string, ManualSetItem[]>([
  [
    'WP8067P',
    [
      'Matt Black',
      'Deep Grey',
      'Ash Grey',
      'Matt White',
      'Dorado Skin',
      'Barbarian Flesh',
      'Topaz Skin',
      'Onyx Skin',
      'Thunderous Blue',
      'Wolf Grey',
      'Ultramarine Blue',
      'Imperial Navy',
      'Crystal Blue',
      'Bright Sapphire',
      'Abyssal Blue',
      'Hydra Turquoise',
      'Marine Mist',
      'Pharaoh Guard',
      'Aqua Alchemy',
      'Angel Green',
      'Greenskin',
      'Rainforest',
      'Autumn Sage',
      'Army Green',
      'Necrotic Flesh',
      'Desert Yellow',
      'Daemonic Yellow',
      'Ice Yellow',
      'Ancient Stone',
      'Oak Brown',
      'Fur Brown',
      'Pure Red',
      'Lava Orange',
      'Wicked Pink',
      'Pixie Pink',
      'Alien Purple',
      'Magecast Magenta',
      'Mulled Berry',
      'Basilisk Red',
      'Wyvern Fury',
    ].map((name) => ({ name, line: 'Warpaints Fanatic', role: '' })),
  ],
])

MANUAL_SET_ITEMS.get('WP8067P')?.push(
  ...['Weapon Bronze', 'Greedy Gold', 'Plate Mail Metal'].map((name) => ({
    name,
    line: 'Warpaints Fanatic',
    role: 'Metallic',
  })),
  ...['True Blood', 'Fresh Rust', 'Oozing Vomit'].map((name) => ({
    name,
    line: 'Warpaints Fanatic Effects',
    role: 'Effects',
  })),
  ...['Dark Tone', 'Strong Tone', 'Soft Tone', 'Strong Skin Shade'].map((name) => ({
    name,
    line: 'Warpaints Fanatic',
    role: 'Wash',
  }))
)

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) return

  const envFile = readFileSync(envPath, 'utf8')

  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue

    const [, rawKey, rawValue] = match
    const key = rawKey.trim()

    if (process.env[key]) continue
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
  }
}

function createServiceClient() {
  loadDotEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the builder.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loadCollectionSource(source: (typeof SOURCE_COLLECTIONS)[number]) {
  if (existsSync(source.file)) {
    return readFile(source.file, 'utf8')
  }

  if (source.tempFile && existsSync(source.tempFile)) {
    const content = await readFile(source.tempFile, 'utf8')
    await writeFile(source.file, content, 'utf8')
    return content
  }

  const response = await fetch(source.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`)
  }

  const content = await response.text()
  await writeFile(source.file, content, 'utf8')
  return content
}

async function loadProducts() {
  await mkdir(path.dirname(IMPORT_CLEAN_CSV), { recursive: true })

  const productsByHandle = new Map<string, ShopifyProduct>()

  for (const source of SOURCE_COLLECTIONS) {
    const content = await loadCollectionSource(source)
    const parsed = JSON.parse(content) as { products?: ShopifyProduct[] }

    for (const product of parsed.products ?? []) {
      productsByHandle.set(product.handle, product)
    }
  }

  return Array.from(productsByHandle.values())
}

async function loadCatalog() {
  const supabase = createServiceClient()
  const paints: CatalogPaint[] = []

  for (const line of VAULT_LINES) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('id, brand, line, name, sku')
      .eq('brand', BRAND)
      .eq('line', line)
      .order('sku')

    if (error) throw new Error(error.message)
    paints.push(...((data ?? []) as CatalogPaint[]))
  }

  return paints.filter((paint) => paint.name && paint.sku)
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&nbsp;/g, ' ')
}

function htmlToText(html: string) {
  return decodeEntities(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\uFFFD/g, '\n')
    .replace(/[•·]/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanItemName(value: string) {
  return value
    .replace(/\([^)]*\)/g, '')
    .replace(/^Warpaints\s+/i, '')
    .replace(/^Fanatic\s+/i, '')
    .replace(/^\d+\s*x\s*/i, '')
    .replace(/\s+\d+\s*x\s+.*$/i, '')
    .replace(/\s+\d+\s*x?\s*\d+\s*ml.*$/i, '')
    .replace(/\s+miniature in image.*$/i, '')
    .replace(/\s+pre-loaded.*$/i, '')
    .replace(/\s+for maximum effect.*$/i, '')
    .replace(/\s+(?:painting guide|care booklet|replacement tips).*$/i, '')
    .replace(/[.;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lineHintForPrefix(prefix: string) {
  if (prefix === 'Speedpaint') return 'Speedpaint'
  if (prefix === 'Speedpaint Markers') return 'Speedpaint Marker'
  if (prefix === 'Warpaints Air') return 'Warpaints Air'
  if (prefix === 'Historical') return 'Historical'
  if (prefix === 'Colour Primer') return 'Colour Primer'
  return 'Warpaints Fanatic'
}

function sourceLineForPrefix(prefix: string) {
  if (prefix === 'Speedpaint') return 'Speedpaint'
  if (prefix === 'Speedpaint Markers') return 'Speedpaint Marker'
  if (prefix === 'Warpaints Air') return 'Warpaints Air'
  if (prefix === 'Historical') return 'Historical'
  if (prefix === 'Colour Primer') return 'Colour Primer'
  if (prefix.includes('Effects')) return 'Warpaints Fanatic Effects'
  if (prefix.includes('Metallic')) return 'Warpaints Fanatic Metallic'
  if (prefix.includes('Wash')) return 'Warpaints Fanatic Wash'
  if (prefix.includes('Masterclass') || prefix.includes('John Blanche')) {
    return 'Warpaints Fanatic Masterclass'
  }
  return 'Warpaints Fanatic'
}

function roleForPrefix(prefix: string) {
  if (prefix === 'Speedpaint Markers') return 'Marker'
  if (prefix === 'Warpaints Air') return 'Air'
  if (prefix === 'Historical') return 'Historical'
  if (prefix === 'Colour Primer') return 'Primer'
  if (prefix.includes('Effects')) return 'Effects'
  if (prefix.includes('Metallic')) return 'Metallic'
  if (prefix.includes('Wash')) return 'Wash'
  if (prefix.includes('Masterclass') || prefix.includes('John Blanche')) return 'Masterclass'
  if (prefix === 'Speedpaint') return 'Speedpaint'
  return ''
}

function resolveItem({
  rawName,
  lineHint,
  catalogByLineAndName,
  catalogByName,
}: {
  rawName: string
  lineHint?: string
  catalogByLineAndName: Map<string, CatalogPaint>
  catalogByName: Map<string, CatalogPaint[]>
}) {
  const cleaned = cleanItemName(rawName)
  if (!cleaned || STOP_LIST_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return null
  }

  const normalized = normalizeName(cleaned)

  if (lineHint) {
    const direct = catalogByLineAndName.get(`${lineHint}\u0000${normalized}`)
    if (direct) return direct
  }

  const matches = catalogByName.get(normalized) ?? []
  if (matches.length === 1) return matches[0]

  const nameAtStartMatches = Array.from(catalogByName.entries())
    .filter(([catalogName]) => normalized.startsWith(catalogName))
    .flatMap(([, paints]) => paints)
    .filter((paint) => !lineHint || paint.line === lineHint)
    .sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))

  return nameAtStartMatches[0] ?? null
}

function extractPrefixedItems(text: string) {
  const prefixPattern = ITEM_PREFIXES.map((prefix) =>
    prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')
  const regex = new RegExp(
    `(${prefixPattern}):\\s*([^:]+?)(?=\\s+(?:${prefixPattern}):|\\s+(?:FREE|Follow|Contents|Includes|Painting guide|10 replacement)\\b|$)`,
    'gi'
  )
  const items: { rawName: string; prefix: string }[] = []

  for (const match of text.replace(/\n+/g, ' ').matchAll(regex)) {
    items.push({ prefix: match[1], rawName: match[2] })
  }

  return items
}

function extractUnprefixedListItems(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const items: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const marker = line.match(/\b(?:Contents|Includes|Bundle includes):\s*(.*)$/i)

    if (!marker) continue

    if (marker[1]?.trim()) {
      items.push(marker[1].trim())
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const candidate = lines[nextIndex].trim()

      if (/^(?:FREE|Follow|Buy the bundle|Painting guide|Pre-loaded)\b/i.test(candidate)) {
        break
      }

      if (STOP_LIST_PATTERNS.some((pattern) => pattern.test(candidate))) continue
      items.push(candidate)
    }
  }

  return items.filter(
    (item) => !ITEM_PREFIXES.some((prefix) => item.toLowerCase().startsWith(`${prefix.toLowerCase()}:`))
  )
}

function nonVaultHintsFor(text: string) {
  return NON_VAULT_PREFIXES.filter((prefix) =>
    new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'i').test(text)
  )
}

function isMarkerProduct(product: ShopifyProduct) {
  const tags = product.tags?.join('|') ?? ''
  return /speedpaint marker/i.test(`${product.title} ${tags}`)
}

function isDefinitelyNonPaintProduct(product: ShopifyProduct, extractedItems: ExtractedItem[]) {
  const text = `${product.title} ${product.tags?.join(' ') ?? ''}`.toLowerCase()

  if (extractedItems.some((item) => item.itemLine || item.paint)) return false
  if (/\bbrush(?:es)?\b/.test(text)) return true
  if (/\bbasing\b/.test(text)) return true
  if (/\btool(?:s)?\b/.test(text)) return true
  if (/\bpaint stand\b/.test(text)) return true
  if (/\bcase(?:s)?\b/.test(text)) return true

  return false
}

function isPaintBearingProduct(product: ShopifyProduct, extractedItems: ExtractedItem[]) {
  if (isDefinitelyNonPaintProduct(product, extractedItems)) return false
  if (extractedItems.length > 0) return true

  const text = `${product.title} ${product.body_html ?? ''} ${
    product.tags?.join(' ') ?? ''
  }`

  return /paint set|paint bundle|paint colours|paint colors|warpaints|speedpaint|gamemaster|historical|infinity|combat se7ens|colour primer|color primer|airbrush|triad/i.test(
    text
  )
}

function sourceUrlFor(product: ShopifyProduct) {
  return `https://thearmypainter.com/products/${product.handle}`
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function productCodeFor(product: ShopifyProduct) {
  return product.variants?.[0]?.sku?.trim() || product.handle
}

function itemLineForSet(items: ResolvedItem[]) {
  const lines = Array.from(new Set(items.map((item) => item.paint.line).filter(Boolean)))
  return lines.length === 1 ? lines[0] ?? '' : 'Mixed Army Painter'
}

function sourceLineForSet(items: ExtractedItem[]) {
  const lines = Array.from(new Set(items.map((item) => item.itemLine).filter(Boolean)))
  return lines.length === 1 ? lines[0] ?? '' : 'Mixed Army Painter'
}

function descriptionFor(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 1200)
}

function expectedPaintCount(product: ShopifyProduct, text: string) {
  const searchable = `${product.title} ${text}`
  const patterns = [
    /\b(\d+)\s*x\s*18\s*ml\b/i,
    /\b(\d+)\s*(?:paint|paints|colours|colors|markers)\b/i,
    /\b(\d+)\s*Warpaints\b/i,
    /\b(\d+)\s*Speedpaints\b/i,
  ]

  for (const pattern of patterns) {
    const match = searchable.match(pattern)
    if (match) return Number(match[1])
  }

  if (/Combat Se7ens/i.test(product.title)) return 7
  if (/Flexible Triad PLUS\+/i.test(product.title)) return 7
  if (/Flexible Triad:/i.test(product.title)) return 6

  return null
}

function isPaintItem(item: ExtractedItem) {
  const name = item.itemName.toLowerCase()

  if (!name) return false
  if (/\b(?:plastic frame cutter|thin plastic glue|super glue|hobby knife|cutting mat|wet palette|drybrush|speedpaint brush)\b/.test(name)) {
    return false
  }
  if (/\b(?:starter set|mega set|complete set|paint set|bundle)\b/.test(name)) {
    return false
  }
  if (/^\d+\s+(?:acrylic|metallic|quickshade|effects?)\s+warpaints?/.test(name)) {
    return false
  }
  if (/^\d+\s+warpaints?:?$/.test(name)) {
    return false
  }

  return Boolean(item.paint || item.itemLine)
}

function gapReason({
  paintBearing,
  rawExtracted,
  unresolvedItems,
  nonVaultHints,
  markerProduct,
}: {
  paintBearing: boolean
  rawExtracted: string[]
  unresolvedItems: string[]
  nonVaultHints: string[]
  markerProduct: boolean
}) {
  if (!paintBearing) return 'not_a_paint_set'
  if (markerProduct) return 'speedpaint_marker_not_in_catalog'
  if (rawExtracted.length === 0) return 'source_does_not_itemize_paints'
  if (unresolvedItems.length > 0) return 'paint_not_in_catalog'
  if (nonVaultHints.length > 0) return 'paint_line_not_in_catalog'
  return ''
}

function paintTypeForLine(line: string) {
  if (line === 'Warpaints Air') return 'airbrush acrylic'
  if (line === 'Speedpaint' || line === 'Speedpaint Marker') return 'speedpaint'
  if (line.includes('Effects')) return 'effect'
  return 'acrylic'
}

function finishForLine(line: string, name: string, role: string) {
  const normalized = normalizeName(`${line} ${name} ${role}`)

  if (normalized.includes('metal') || normalized.includes('gold') || normalized.includes('bronze')) {
    return 'metallic'
  }

  if (normalized.includes('varnish')) return 'varnish'
  if (/\b(?:wash|tone)\b/.test(normalized) || role === 'Wash') return 'wash'
  return 'matte'
}

function includeMissingPaintInDataset(row: Record<string, string | number>) {
  const line = String(row.item_line ?? '')
  const name = String(row.item_name ?? '')

  if (!line || !name) return false
  if (line === 'Speedpaint Marker') return false
  if (/^\d+\s+speedpaint markers?:/i.test(name)) return false
  if (name.includes(',')) return false

  return true
}

async function main() {
  const products = await loadProducts()
  const catalog = await loadCatalog()
  const catalogByLineAndName = new Map<string, CatalogPaint>()
  const catalogByName = new Map<string, CatalogPaint[]>()
  const review: ReviewEntry[] = []
  const sourceRows: Record<string, string | number>[] = []
  const coverageRows: Record<string, string | number>[] = []
  const catalogGapRows = new Map<string, Record<string, string | number>>()
  const importRows: Record<string, string | number>[] = []

  for (const paint of catalog) {
    const normalized = normalizeName(paint.name ?? '')
    catalogByLineAndName.set(`${paint.line}\u0000${normalized}`, paint)
    catalogByName.set(normalized, [...(catalogByName.get(normalized) ?? []), paint])
  }

  for (const product of products) {
    const productCode = productCodeFor(product)
    const sourceUrl = sourceUrlFor(product)
    const text = htmlToText(product.body_html ?? '')
    const manualItems = MANUAL_SET_ITEMS.get(productCode) ?? []

    const nonVaultHints = nonVaultHintsFor(text)
    const prefixedItems = manualItems.length ? [] : extractPrefixedItems(text)
    const unprefixedItems = manualItems.length ? [] : extractUnprefixedListItems(text)
    const rawExtracted = [
      ...manualItems.map((item) => `${item.line}: ${item.name}`),
      ...prefixedItems.map((item) => `${item.prefix}: ${item.rawName}`),
      ...unprefixedItems,
    ]
    const extractedItems: ExtractedItem[] = []
    const resolvedItems: ResolvedItem[] = []
    const unresolvedItems: string[] = []

    for (const item of manualItems) {
      const paint = resolveItem({
        rawName: item.name,
        lineHint: item.line === 'Warpaints Fanatic Effects' ? 'Warpaints Fanatic' : item.line,
        catalogByLineAndName,
        catalogByName,
      })
      const sourceItem = {
        rawName: `${item.line}: ${item.name}`,
        prefix: item.line,
        itemName: paint?.name ?? item.name,
        itemLine: paint?.line ?? item.line,
        itemRole: item.role,
        paint,
      }

      if (!isPaintItem(sourceItem)) continue
      extractedItems.push(sourceItem)

      if (!paint) {
        unresolvedItems.push(`${item.line}: ${item.name}`)
        continue
      }

      resolvedItems.push({
        sourceName: item.name,
        itemRole: item.role,
        paint,
      })
    }

    for (const item of prefixedItems) {
      const lineHint = lineHintForPrefix(item.prefix)
      const paint = resolveItem({
        rawName: item.rawName,
        lineHint,
        catalogByLineAndName,
        catalogByName,
      })
      const sourceItem = {
        rawName: `${item.prefix}: ${item.rawName}`,
        prefix: item.prefix,
        itemName: paint?.name ?? cleanItemName(item.rawName),
        itemLine: paint?.line ?? sourceLineForPrefix(item.prefix),
        itemRole: roleForPrefix(item.prefix),
        paint,
      }

      if (!isPaintItem(sourceItem)) continue
      extractedItems.push(sourceItem)

      if (!paint) {
        unresolvedItems.push(`${item.prefix}: ${item.rawName}`)
        continue
      }

      resolvedItems.push({
        sourceName: cleanItemName(item.rawName),
        itemRole: roleForPrefix(item.prefix),
        paint,
      })
    }

    for (const item of unprefixedItems) {
      const productLineHint =
        /SPEEDPAINT/i.test(`${product.title} ${product.tags?.join(' ') ?? ''}`) &&
        !/WARPAINTS FANATIC/i.test(`${product.title} ${product.tags?.join(' ') ?? ''}`)
          ? 'Speedpaint'
          : /WARPAINTS FANATIC/i.test(`${product.title} ${product.tags?.join(' ') ?? ''}`)
            ? 'Warpaints Fanatic'
            : undefined
      const paint = resolveItem({
        rawName: item,
        lineHint: productLineHint,
        catalogByLineAndName,
        catalogByName,
      })
      const sourceItem = {
        rawName: item,
        prefix: '',
        itemName: paint?.name ?? cleanItemName(item),
        itemLine: paint?.line ?? productLineHint ?? '',
        itemRole: '',
        paint,
      }

      if (!isPaintItem(sourceItem)) continue
      extractedItems.push(sourceItem)

      if (!paint) {
        unresolvedItems.push(item)
        continue
      }

      resolvedItems.push({
        sourceName: cleanItemName(item),
        itemRole: '',
        paint,
      })
    }

    const markerProduct = isMarkerProduct(product)
    const paintBearing = isPaintBearingProduct(product, extractedItems)
    const expectedCount = expectedPaintCount(product, text)
    const itemizedExtracted = extractedItems.map((item) => item.rawName)
    const gap = gapReason({
      paintBearing,
      rawExtracted: itemizedExtracted,
      unresolvedItems,
      nonVaultHints,
      markerProduct,
    })

    if (!paintBearing) {
      continue
    }

    coverageRows.push({
      set_product_code: productCode,
      set_name: product.title,
      source_url: sourceUrl,
      expected_paint_count: expectedCount ?? '',
      itemized_paint_count: extractedItems.length,
      catalog_matched_count: extractedItems.filter((item) => item.paint).length,
      catalog_unmatched_count: extractedItems.filter((item) => !item.paint).length,
      has_clean_import: gap ? 'no' : 'yes',
      gap_reason: gap,
      gap_detail:
        unresolvedItems.length > 0
          ? unresolvedItems.join(' | ')
          : nonVaultHints.length > 0
            ? nonVaultHints.join(' | ')
            : '',
    })

    if (extractedItems.length) {
      const sourceSetLine = sourceLineForSet(extractedItems)
      const sourceItemQuantities = new Map<string, ExtractedItem & { quantity: number }>()

      for (const item of extractedItems) {
        const key = `${item.itemLine}\u0000${item.itemName}\u0000${item.itemRole}\u0000${item.paint?.sku ?? ''}`
        const existing = sourceItemQuantities.get(key)

        sourceItemQuantities.set(key, {
          ...item,
          quantity: (existing?.quantity ?? 0) + 1,
        })
      }

      for (const item of sourceItemQuantities.values()) {
        if (!item.paint) {
          const gapKey = `${item.itemLine}\u0000${item.itemName}`
          const existingSets = String(catalogGapRows.get(gapKey)?.sets ?? '')
          const sets = Array.from(
            new Set([...existingSets.split(' | ').filter(Boolean), productCode])
          ).join(' | ')

          catalogGapRows.set(gapKey, {
            item_line: item.itemLine,
            item_name: item.itemName,
            item_role: item.itemRole,
            source_item_name: item.rawName,
            sets,
          })
        }

        sourceRows.push({
          set_product_code: productCode,
          set_name: product.title,
          brand: BRAND,
          line: sourceSetLine,
          manufacturer: MANUFACTURER,
          set_description: descriptionFor(text),
          set_source_url: sourceUrl,
          item_product_code: item.paint?.sku ?? '',
          item_line: item.itemLine,
          item_name: item.itemName,
          item_role: item.itemRole,
          quantity: item.quantity,
          source_item_name: item.rawName,
          catalog_match_status: item.paint ? 'matched' : 'unmatched',
          extraction_status: 'itemized',
        })
      }
    } else {
      sourceRows.push({
        set_product_code: productCode,
        set_name: product.title,
        brand: BRAND,
        line: '',
        manufacturer: MANUFACTURER,
        set_description: descriptionFor(text),
        set_source_url: sourceUrl,
        item_product_code: '',
        item_line: '',
        item_name: '',
        item_role: '',
        quantity: '',
        source_item_name: '',
        catalog_match_status: '',
        extraction_status: 'no_source_paint_list_found',
      })
    }

    if (markerProduct) {
      review.push({
        productCode,
        title: product.title,
        sourceUrl,
        status: 'skipped',
        reason: 'speedpaint_marker_not_a_vault_paint_line',
        extractedItems: rawExtracted,
        unresolvedItems,
      })
      continue
    }

    if (nonVaultHints.length) {
      review.push({
        productCode,
        title: product.title,
        sourceUrl,
        status: 'skipped',
        reason: 'contains_non_vault_line_items',
        extractedItems: rawExtracted,
        unresolvedItems,
        nonVaultHints,
      })
      continue
    }

    if (rawExtracted.length === 0) {
      review.push({
        productCode,
        title: product.title,
        sourceUrl,
        status: 'skipped',
        reason: 'no_source_paint_list_found',
      })
      continue
    }

    if (unresolvedItems.length) {
      review.push({
        productCode,
        title: product.title,
        sourceUrl,
        status: 'skipped',
        reason: 'unresolved_items',
        extractedItems: rawExtracted,
        unresolvedItems,
      })
      continue
    }

    if (resolvedItems.length === 0) {
      review.push({
        productCode,
        title: product.title,
        sourceUrl,
        status: 'skipped',
        reason: 'no_vault_items_resolved',
        extractedItems: rawExtracted,
      })
      continue
    }

    const itemQuantities = new Map<string, ResolvedItem & { quantity: number }>()

    for (const item of resolvedItems) {
      const key = `${item.paint.sku}\u0000${item.itemRole}`
      const existing = itemQuantities.get(key)

      itemQuantities.set(key, {
        ...item,
        quantity: (existing?.quantity ?? 0) + 1,
      })
    }

    const setLine = itemLineForSet(Array.from(itemQuantities.values()))

    for (const item of itemQuantities.values()) {
      importRows.push({
        set_product_code: productCode,
        set_name: product.title,
        brand: BRAND,
        line: setLine,
        manufacturer: MANUFACTURER,
        set_description: descriptionFor(text),
        set_source_url: sourceUrl,
        item_product_code: item.paint.sku ?? '',
        item_line: item.paint.line ?? '',
        item_name: item.paint.name ?? '',
        item_role: item.itemRole,
        quantity: item.quantity,
      })
    }

    review.push({
      productCode,
      title: product.title,
      sourceUrl,
      status: 'imported',
      extractedItems: rawExtracted,
      importedItems: itemQuantities.size,
    })
  }

  const columns = [
    'set_product_code',
    'set_name',
    'brand',
    'line',
    'manufacturer',
    'set_description',
    'set_source_url',
    'item_product_code',
    'item_line',
    'item_name',
    'item_role',
    'quantity',
  ]
  const sourceColumns = [
    ...columns,
    'source_item_name',
    'catalog_match_status',
    'extraction_status',
  ]
  const coverageColumns = [
    'set_product_code',
    'set_name',
    'source_url',
    'expected_paint_count',
    'itemized_paint_count',
    'catalog_matched_count',
    'catalog_unmatched_count',
    'has_clean_import',
    'gap_reason',
    'gap_detail',
  ]
  const gapColumns = [
    'item_line',
    'item_name',
    'item_role',
    'source_item_name',
    'sets',
  ]
  const missingDatasetColumns = [
    'id',
    'brand',
    'line',
    'name',
    'sku',
    'swatch_image_url',
    'hex_approx',
    'finish',
    'paint_type',
    'is_active',
    'created_at',
  ]
  const missingReportColumns = [
    'brand',
    'line',
    'name',
    'sku',
    'finish',
    'paint_type',
    'source_sets',
    'source_item_name',
    'notes',
  ]
  const missingPaintRows = Array.from(catalogGapRows.values())
    .filter(includeMissingPaintInDataset)
    .map((row) => {
      const line = String(row.item_line ?? '')
      const name = String(row.item_name ?? '')
      const role = String(row.item_role ?? '')

      return {
        id: '',
        brand: BRAND,
        line,
        name,
        sku: '',
        swatch_image_url: '',
        hex_approx: '',
        finish: finishForLine(line, name, role),
        paint_type: paintTypeForLine(line),
        is_active: 'true',
        created_at: '',
        source_sets: String(row.sets ?? ''),
        source_item_name: String(row.source_item_name ?? ''),
        notes: 'Missing from paint_catalog; discovered while extracting Army Painter paint sets.',
      }
    })
    .sort((a, b) => a.line.localeCompare(b.line) || a.name.localeCompare(b.name))
  const sourceCsv = [
    sourceColumns.join(','),
    ...sourceRows.map((row) =>
      sourceColumns.map((column) => csvValue(row[column])).join(',')
    ),
  ].join('\r\n')
  const coverageCsv = [
    coverageColumns.join(','),
    ...coverageRows.map((row) =>
      coverageColumns.map((column) => csvValue(row[column])).join(',')
    ),
  ].join('\r\n')
  const gapsCsv = [
    gapColumns.join(','),
    ...Array.from(catalogGapRows.values())
      .sort((a, b) =>
        String(a.item_line).localeCompare(String(b.item_line)) ||
        String(a.item_name).localeCompare(String(b.item_name))
      )
      .map((row) => gapColumns.map((column) => csvValue(row[column])).join(',')),
  ].join('\r\n')
  const missingDatasetCsv = [
    missingDatasetColumns.join(','),
    ...missingPaintRows.map((row) =>
      missingDatasetColumns.map((column) => csvValue(row[column as keyof typeof row])).join(',')
    ),
  ].join('\r\n')
  const missingReportCsv = [
    missingReportColumns.join(','),
    ...missingPaintRows.map((row) =>
      missingReportColumns.map((column) => csvValue(row[column as keyof typeof row])).join(',')
    ),
  ].join('\r\n')
  const importCsv = [
    columns.join(','),
    ...importRows.map((row) =>
      columns.map((column) => csvValue(row[column])).join(',')
    ),
  ].join('\r\n')
  const sourceSets = new Set(sourceRows.map((row) => row.set_product_code))
  const importedSets = new Set(importRows.map((row) => row.set_product_code))
  const summary = {
    sourceProducts: products.length,
    paintBearingSets: coverageRows.length,
    catalogPaints: catalog.length,
    sourceCsvSets: sourceSets.size,
    sourceCsvRows: sourceRows.length,
    catalogGapPaints: catalogGapRows.size,
    missingPaintDatasetRows: missingPaintRows.length,
    importedSets: importedSets.size,
    importedItemRows: importRows.length,
    skippedProducts: review.filter((entry) => entry.status === 'skipped').length,
    skippedByReason: review
      .filter((entry) => entry.status === 'skipped')
      .reduce<Record<string, number>>((accumulator, entry) => {
        const reason = entry.reason ?? 'unknown'
        accumulator[reason] = (accumulator[reason] ?? 0) + 1
        return accumulator
      }, {}),
    sourceCsv: SOURCE_CSV,
    setCoverageCsv: SET_COVERAGE_CSV,
    catalogGapsCsv: CATALOG_GAPS_CSV,
    missingPaintDatasetCsv: MISSING_PAINT_DATASET_CSV,
    missingPaintReportCsv: MISSING_PAINT_REPORT_CSV,
    importCleanCsv: IMPORT_CLEAN_CSV,
    reviewJson: REVIEW_JSON,
  }

  await writeFile(SOURCE_CSV, `${sourceCsv}\r\n`, 'utf8')
  await writeFile(SET_COVERAGE_CSV, `${coverageCsv}\r\n`, 'utf8')
  await writeFile(CATALOG_GAPS_CSV, `${gapsCsv}\r\n`, 'utf8')
  await writeFile(MISSING_PAINT_DATASET_CSV, `${missingDatasetCsv}\r\n`, 'utf8')
  await writeFile(MISSING_PAINT_REPORT_CSV, `${missingReportCsv}\r\n`, 'utf8')
  await writeFile(IMPORT_CLEAN_CSV, `${importCsv}\r\n`, 'utf8')
  await writeFile(
    REVIEW_JSON,
    `${JSON.stringify({ summary, products: review }, null, 2)}\n`,
    'utf8'
  )

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
