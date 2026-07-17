import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type BrandLine = {
  brand: string
  line: string
  catalog_paint_count: string
}

type Row = {
  brand: string
  line: string
  catalog_paint_count: string
  set_catalogue_name: string
  set_name: string
  set_product_code: string
  set_page_url: string
  source_url: string
  source_status: string
  discovery_method: string
  confidence: string
  notes: string
}

const workspaceRoot = process.cwd()
const brandLinesPath = path.join(workspaceRoot, 'downloads', 'reference', 'paint-catalog-brand-lines.csv')
const outputPath = path.join(workspaceRoot, 'downloads', 'reference', 'paint-set-catalogue-index.csv')

function parseCsv(text: string): BrandLine[] {
  const lines = text.trim().split(/\r?\n/)
  const header = splitCsvLine(lines.shift() ?? '')
  return lines.filter(Boolean).map((line) => {
    const cells = splitCsvLine(line)
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ''])) as BrandLine
  })
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function writeCsv(rows: Row[]) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const header = [
    'brand',
    'line',
    'catalog_paint_count',
    'set_catalogue_name',
    'set_name',
    'set_product_code',
    'set_page_url',
    'source_url',
    'source_status',
    'discovery_method',
    'confidence',
    'notes',
  ]
  const body = rows.map((row) => header.map((key) => csvEscape(row[key as keyof Row] ?? '')).join(','))
  fs.writeFileSync(outputPath, `${header.join(',')}\n${body.join('\n')}\n`)
}

function rowFor(line: BrandLine, patch: Partial<Row>): Row {
  return {
    brand: line.brand,
    line: line.line,
    catalog_paint_count: line.catalog_paint_count,
    set_catalogue_name: '',
    set_name: '',
    set_product_code: '',
    set_page_url: '',
    source_url: '',
    source_status: 'needs_research',
    discovery_method: 'brand_line_export',
    confidence: 'low',
    notes: '',
    ...patch,
  }
}

function productCodeFromTitle(title: string, sku: string): string {
  if (sku) return sku
  const match = title.match(/\b([A-Z]{1,5}\d{3,5}[A-Z]?)\b/i)
  return match?.[1] ?? ''
}

function armyPainterRows(lines: BrandLine[]): Row[] {
  const paintSetJson = path.join(os.tmpdir(), 'army-painter-paint-sets.json')
  const triadJson = path.join(os.tmpdir(), 'army-painter-flexible-triads.json')
  const rows: Row[] = []
  const byLine = new Map(lines.filter((line) => line.brand === 'Army Painter').map((line) => [line.line, line]))

  for (const source of [
    {
      path: paintSetJson,
      url: 'https://thearmypainter.com/collections/all-paint-sets/products.json?limit=250',
      catalogue: 'All Paint Sets',
    },
    {
      path: triadJson,
      url: 'https://thearmypainter.com/collections/flexible-triads/products.json?limit=250',
      catalogue: 'Flexible Triads',
    },
  ]) {
    if (!fs.existsSync(source.path)) continue
    const products = JSON.parse(fs.readFileSync(source.path, 'utf8')).products ?? []
    for (const product of products) {
      const tags = new Set<string>((product.tags ?? []).map((tag: string) => tag.toLowerCase()))
      const title = product.title as string
      const lineName = tags.has('speedpaint') || /speedpaint/i.test(title) ? 'Speedpaint' : 'Warpaints Fanatic'
      const line = byLine.get(lineName)
      if (!line) continue
      const sku = product.variants?.[0]?.sku ?? ''
      rows.push(rowFor(line, {
        set_catalogue_name: source.catalogue,
        set_name: title,
        set_product_code: productCodeFromTitle(title, sku),
        set_page_url: `https://thearmypainter.com/products/${product.handle}`,
        source_url: source.url,
        source_status: 'discovered_set',
        discovery_method: 'shopify_products_json',
        confidence: 'high',
        notes: (product.available === false || product.variants?.[0]?.available === false) ? 'Product feed marks first variant unavailable.' : '',
      }))
    }
  }
  return rows
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function greenStuffWorldRows(lines: BrandLine[]): Row[] {
  const sourcePaths = [1, 2, 3, 4, 5]
    .map((page) => path.join(os.tmpdir(), `gsw-paint-sets-${page}.html`))
    .filter((sourcePath) => fs.existsSync(sourcePath))
  if (sourcePaths.length === 0) {
    const fallbackPath = path.join(os.tmpdir(), 'gsw-paint-sets.html')
    if (fs.existsSync(fallbackPath)) sourcePaths.push(fallbackPath)
  }
  if (sourcePaths.length === 0) return []
  const rows: Row[] = []
  const seenUrls = new Set<string>()
  const byLine = new Map(lines.filter((line) => line.brand === 'Green Stuff World').map((line) => [line.line, line]))
  const cardRegex = /<article[\s\S]*?<\/article>/g
  for (const sourcePath of sourcePaths) {
    const html = fs.readFileSync(sourcePath, 'utf8')
    for (const cardMatch of html.matchAll(cardRegex)) {
      const card = cardMatch[0]
      const titleMatch = card.match(/<h3[^>]*class="[^"]*product-title[^"]*"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
      if (!titleMatch) continue
      const referenceMatch = card.match(/Reference:\s*<span><strong>([^<]+)<\/strong><\/span>/)
      const title = stripHtml(titleMatch[2])
      const url = titleMatch[1].replace(/&amp;/g, '&')
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      const lower = title.toLowerCase()
      const lineName =
        lower.includes('dipping ink') ? 'Dipping Inks' :
        lower.includes('chrome') ? 'Chrome Paints' :
        lower.includes('fluor') || lower.includes('fluorescent') ? 'Fluor Paints' :
        lower.includes('opaque') ? 'Opaque Colors' :
        lower.includes('metallic') || lower.includes('colorshift') || lower.includes('chameleon') ? 'Metallic & Colorshift Paints' :
        lower.includes('ink') || lower.includes('wash') ? 'Inks, Washes & Dyes' :
        'Acrylic Colors'
      const line = byLine.get(lineName)
      if (!line) continue
      rows.push(rowFor(line, {
        set_catalogue_name: 'Model Paint Sets',
        set_name: title,
        set_product_code: referenceMatch?.[1]?.trim() ?? '',
        set_page_url: url,
        source_url: 'https://www.greenstuffworld.com/en/123-paint-sets',
        source_status: 'discovered_set',
        discovery_method: 'prestashop_category_html',
        confidence: 'medium',
        notes: 'Line assignment inferred from product title; verify contents on product page before import.',
      }))
    }
  }
  return rows
}

type VallejoSet = {
  brand: 'Vallejo'
  categoryName: string
  productCode: string
  setName: string
  setPageUrl: string
  sourceUrl: string
}

function vallejoRows(lines: BrandLine[]): Row[] {
  const sourcePath = path.join(workspaceRoot, 'downloads', 'reference', 'vallejo-hobby-set-catalogue.json')
  if (!fs.existsSync(sourcePath)) return []
  const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as { sets?: VallejoSet[] }
  const byLine = new Map(lines.filter((line) => line.brand === 'Vallejo').map((line) => [line.line, line]))
  const rows: Row[] = []
  for (const set of data.sets ?? []) {
    const mappedLine = mapVallejoSetLine(set)
    const line = byLine.get(mappedLine) ?? {
      brand: 'Vallejo',
      line: mappedLine,
      catalog_paint_count: '0',
    }
    const importedTrueMetallic = set.categoryName === 'True Metallic Metal Sets'
    rows.push(rowFor(line, {
      set_catalogue_name: set.categoryName,
      set_name: set.setName,
      set_product_code: set.productCode,
      set_page_url: set.setPageUrl,
      source_url: set.sourceUrl,
      source_status: importedTrueMetallic ? 'imported_set' : 'discovered_set',
      discovery_method: 'browser_dom_snapshot',
      confidence: 'high',
      notes: importedTrueMetallic
        ? 'Already imported from the True Metallic Metal set CSV.'
        : 'Discovered from Vallejo Hobby > Sets category; extract product page contents before import.',
    }))
  }
  return rows
}

function mapVallejoSetLine(set: VallejoSet): string {
  const codePrefix = set.productCode.slice(0, 2)
  const title = set.setName.toLowerCase()
  const category = set.categoryName.toLowerCase()

  if (category.includes('true metallic')) return 'True Metallic Metal Base'
  if (category.includes('shifter')) return 'Liquid Metal'
  if (category.includes('metal color')) return 'Liquid Metal'
  if (category.includes('pigment')) return 'Pigment FX'
  if (category.includes('diorama')) return 'Pigment FX'
  if (category.includes('premium')) return 'Premium Color'
  if (category.includes('wizkids')) return 'WizKids'

  if (title.includes('xpress')) return 'Xpress Color'
  if (title.includes('game air')) return 'Game Air'
  if (title.includes('model air')) return 'Model Air'
  if (title.includes('true metallic')) return 'True Metallic Metal Base'

  if (codePrefix === '70') return 'Model Color'
  if (codePrefix === '71') return 'Model Air'
  if (codePrefix === '72') return 'Game Color'
  if (codePrefix === '73') return 'Pigment FX'
  if (codePrefix === '69') return 'Mecha Color'
  if (codePrefix === '77') return 'True Metallic Metal Base'
  if (codePrefix === '80') return 'WizKids'
  if (codePrefix === '62') return 'Premium Color'

  return 'Unmapped Vallejo Set'
}

function staticRows(lines: BrandLine[]): Row[] {
  const rows: Row[] = []
  const find = (brand: string, line: string) => lines.find((entry) => entry.brand === brand && entry.line === line)

  const catalogueSeeds: Array<[string, string, string, string, string]> = [
    ['AK Interactive', '3GEN Acrylics', '3GEN Acrylic Paint Sets', 'https://ak-interactive.com/product-category/paints/sets-paints/', 'Seed URL needs endpoint verification; attempted HTML fetch did not expose a usable product grid.'],
    ['AK Interactive', 'Quick Gen', 'Quick Gen Sets', 'https://ak-interactive.com/product-category/paints/quick-gen/', 'Official AK Quick Gen category; verify whether bundles/sets are mixed with singles.'],
    ['Green Stuff World', 'Acrylic Colors', 'Model Paint Sets', 'https://www.greenstuffworld.com/en/123-paint-sets', 'Official GSW paint set category downloaded as HTML; parse pagination and product pages before import.'],
    ['Pro Acryl', 'Standard Colors', 'Paint Sets', 'https://monumenthobbies.com/collections/pro-acryl-paint-sets', 'Official Monument Hobbies collection returned no Shopify products at products.json; crawl HTML collection.'],
    ['Warhammer Colour', 'Base', 'Paints + Tools Sets', 'https://www.warhammer.com/en-US/shop/paints-tools', 'Warhammer storefront mixes singles, tools, and sets; crawl with filters/manual verification.'],
  ]

  for (const [brand, lineName, catalogue, url, notes] of catalogueSeeds) {
    const line = find(brand, lineName)
    if (!line) continue
    rows.push(rowFor(line, {
      set_catalogue_name: catalogue,
      set_name: catalogue,
      set_page_url: url,
      source_url: url,
      source_status: 'catalogue_seed',
      discovery_method: 'official_catalogue_url',
      confidence: 'medium',
      notes,
    }))
  }

  return rows
}

function coverageRows(lines: BrandLine[], existing: Row[]): Row[] {
  const covered = new Set(existing.map((row) => `${row.brand}\u0000${row.line}`))
  return lines
    .filter((line) => !covered.has(`${line.brand}\u0000${line.line}`))
    .map((line) => rowFor(line, {
      source_status: 'needs_source_discovery',
      discovery_method: 'brand_line_export',
      confidence: 'low',
      notes: 'No high-confidence public paint-set catalogue source captured in this pass.',
    }))
}

function main() {
  const lines = parseCsv(fs.readFileSync(brandLinesPath, 'utf8'))
  const rows = [
    ...armyPainterRows(lines),
    ...greenStuffWorldRows(lines),
    ...vallejoRows(lines),
    ...staticRows(lines),
  ]
  rows.push(...coverageRows(lines, rows))
  rows.sort((a, b) => `${a.brand}\u0000${a.line}\u0000${a.set_name}`.localeCompare(`${b.brand}\u0000${b.line}\u0000${b.set_name}`))
  writeCsv(rows)
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.source_status] = (acc[row.source_status] ?? 0) + 1
    return acc
  }, {})
  console.log(JSON.stringify({ outputPath, brandLines: lines.length, rows: rows.length, statusCounts }, null, 2))
}

main()
