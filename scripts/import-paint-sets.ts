import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CsvRow = {
  set_product_code: string
  set_name: string
  brand: string
  line: string
  manufacturer: string
  set_description: string
  set_source_url: string
  item_product_code: string
  item_line?: string
  item_name: string
  item_role: string
  quantity: string
}

type PaintCatalogMatch = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
}

type PaintSetRow = {
  id: string
  name: string
  brand: string
  line: string | null
  manufacturer: string | null
  description: string | null
  product_code: string | null
  source_url: string | null
  is_active: boolean
}

type PaintSetItemInsert = {
  paint_set_id: string
  paint_id: string
  source_product_code: string
  item_role: string | null
  quantity: number
}

const TRUE_METALLIC_ROLE_LINES = new Map([
  ['Light', 'True Metallic Metal Light'],
  ['Base', 'True Metallic Metal Base'],
  ['Shade', 'True Metallic Metal Shade'],
  ['Airbrush', 'True Metallic Metal Airbrush'],
])

function parseArgs() {
  const args = process.argv.slice(2)

  return {
    dryRun: !args.includes('--import'),
    file:
      args.find((arg) => arg.startsWith('--file='))?.slice('--file='.length) ??
      path.join(
        process.cwd(),
        'downloads',
        'reference',
        'vallejo-true-metallic-metal-sets.csv'
      ),
    replaceItems: args.includes('--replace-items'),
    resolvedOutput: args
      .find((arg) => arg.startsWith('--resolved-output='))
      ?.slice('--resolved-output='.length),
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"'
      index += 1
      continue
    }

    if (character === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (character === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += character
  }

  cells.push(current)
  return cells
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]) as (keyof CsvRow)[]

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ''])
    ) as CsvRow
  })
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort()
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

function expectedLineFor(row: CsvRow) {
  if (row.item_line) return row.item_line

  if (row.line === 'True Metallic Metal') {
    return TRUE_METALLIC_ROLE_LINES.get(row.item_role) ?? row.line
  }

  return row.line
}

function resolutionKeyFor(row: CsvRow) {
  return `${row.item_product_code}\u0000${expectedLineFor(row)}\u0000${row.item_role}`
}

function assertRequiredRows(rows: CsvRow[]) {
  const missing = rows.flatMap((row, index) => {
    const rowNumber = index + 2
    const fields: string[] = []

    if (!row.set_product_code) fields.push('set_product_code')
    if (!row.set_name) fields.push('set_name')
    if (!row.brand) fields.push('brand')
    if (!row.item_product_code) fields.push('item_product_code')
    if (!row.item_name) fields.push('item_name')

    return fields.map((field) => `line ${rowNumber}: missing ${field}`)
  })

  if (missing.length) {
    throw new Error(missing.join('\n'))
  }
}

function createServiceClient() {
  loadDotEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running imports.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

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

async function loadPaintMatches(
  supabase: ReturnType<typeof createServiceClient>,
  itemCodes: string[]
) {
  const matches: PaintCatalogMatch[] = []

  for (const chunk of chunkArray(itemCodes, 100)) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('id, brand, line, name, sku')
      .in('sku', chunk)

    if (error) throw new Error(error.message)
    matches.push(...((data ?? []) as PaintCatalogMatch[]))
  }

  const bySku = new Map<string, PaintCatalogMatch[]>()

  for (const match of matches) {
    if (!match.sku) continue
    bySku.set(match.sku, [...(bySku.get(match.sku) ?? []), match])
  }

  return bySku
}

function resolvePaintIds(rows: CsvRow[], bySku: Map<string, PaintCatalogMatch[]>) {
  const errors: string[] = []
  const resolved = new Map<string, PaintCatalogMatch>()

  for (const row of rows) {
    const resolutionKey = resolutionKeyFor(row)

    if (resolved.has(resolutionKey)) continue

    const matches = bySku.get(row.item_product_code) ?? []

    if (matches.length === 0) {
      errors.push(`No paint_catalog match for SKU ${row.item_product_code}`)
      continue
    }

    const expectedLine = expectedLineFor(row)
    const lineMatches = matches.filter((match) => match.line === expectedLine)
    const brandLineMatches = lineMatches.filter((match) => match.brand === row.brand)
    const candidates =
      brandLineMatches.length > 0
        ? brandLineMatches
        : lineMatches.length > 0
          ? lineMatches
          : matches

    if (candidates.length !== 1) {
      errors.push(
        `Ambiguous SKU ${row.item_product_code}: ${candidates
          .map((match) => `${match.id} ${match.brand} / ${match.line} / ${match.name}`)
          .join('; ')}`
      )
      continue
    }

    const [candidate] = candidates
    const normalizedExpectedName =
      row.line === 'True Metallic Metal' && row.item_role
        ? `${row.item_name} ${row.item_role}`
        : row.item_name

    if (candidate.name !== normalizedExpectedName) {
      errors.push(
        `Name mismatch for SKU ${row.item_product_code}: CSV expected "${normalizedExpectedName}", catalog has "${candidate.name}"`
      )
      continue
    }

    resolved.set(resolutionKey, candidate)
  }

  if (errors.length) {
    throw new Error(errors.join('\n'))
  }

  return resolved
}

function groupBySet(rows: CsvRow[]) {
  const grouped = new Map<string, CsvRow[]>()

  for (const row of rows) {
    grouped.set(row.set_product_code, [
      ...(grouped.get(row.set_product_code) ?? []),
      row,
    ])
  }

  return grouped
}

async function upsertPaintSets(
  supabase: ReturnType<typeof createServiceClient>,
  rows: CsvRow[]
) {
  const grouped = groupBySet(rows)
  const paintSets = Array.from(grouped.values()).map((setRows) => {
    const first = setRows[0]

    return {
      name: first.set_name,
      brand: first.brand,
      line: first.line || null,
      manufacturer: first.manufacturer || null,
      description: first.set_description || null,
      product_code: first.set_product_code,
      source_url: first.set_source_url || null,
      is_active: true,
    }
  })

  const { data, error } = await supabase
    .from('paint_sets')
    .upsert(paintSets, { onConflict: 'product_code' })
    .select('id, name, brand, line, manufacturer, description, product_code, source_url, is_active')

  if (error) throw new Error(error.message)

  return new Map(
    ((data ?? []) as PaintSetRow[]).map((paintSet) => [
      paintSet.product_code ?? '',
      paintSet,
    ])
  )
}

async function upsertPaintSetItems(
  supabase: ReturnType<typeof createServiceClient>,
  rows: CsvRow[],
  paintSetsByProductCode: Map<string, PaintSetRow>,
  paintsByResolutionKey: Map<string, PaintCatalogMatch>
) {
  const items: PaintSetItemInsert[] = rows.map((row) => {
    const paintSet = paintSetsByProductCode.get(row.set_product_code)
    const paint = paintsByResolutionKey.get(resolutionKeyFor(row))

    if (!paintSet) throw new Error(`Missing paint set ${row.set_product_code}`)
    if (!paint) throw new Error(`Missing paint ${row.item_product_code}`)

    return {
      paint_set_id: paintSet.id,
      paint_id: paint.id,
      source_product_code: row.item_product_code,
      item_role: row.item_role || null,
      quantity: Math.max(1, Number(row.quantity || 1)),
    }
  })

  for (const chunk of chunkArray(items, 200)) {
    const { error } = await supabase
      .from('paint_set_items')
      .upsert(chunk, { onConflict: 'paint_set_id,paint_id' })

    if (error) throw new Error(error.message)
  }
}

async function deleteExistingPaintSetItems(
  supabase: ReturnType<typeof createServiceClient>,
  paintSetsByProductCode: Map<string, PaintSetRow>
) {
  const paintSetIds = Array.from(paintSetsByProductCode.values()).map((set) => set.id)

  for (const chunk of chunkArray(paintSetIds, 100)) {
    const { error } = await supabase
      .from('paint_set_items')
      .delete()
      .in('paint_set_id', chunk)

    if (error) throw new Error(error.message)
  }
}

async function writeResolvedCsv({
  outputPath,
  rows,
  paintsByResolutionKey,
}: {
  outputPath: string
  rows: CsvRow[]
  paintsByResolutionKey: Map<string, PaintCatalogMatch>
}) {
  const columns = [
    'set_product_code',
    'set_name',
    'item_product_code',
    'item_name',
    'item_role',
    'paint_catalog_id',
    'catalog_brand',
    'catalog_line',
    'catalog_name',
    'catalog_sku',
  ]
  const csvRows = rows.map((row) => {
    const paint = paintsByResolutionKey.get(resolutionKeyFor(row))

    return {
      set_product_code: row.set_product_code,
      set_name: row.set_name,
      item_product_code: row.item_product_code,
      item_name: row.item_name,
      item_role: row.item_role,
      paint_catalog_id: paint?.id ?? '',
      catalog_brand: paint?.brand ?? '',
      catalog_line: paint?.line ?? '',
      catalog_name: paint?.name ?? '',
      catalog_sku: paint?.sku ?? '',
    }
  })
  const csv = [
    columns.join(','),
    ...csvRows.map((row) =>
      columns
        .map((column) => csvValue(row[column as keyof typeof row]))
        .join(',')
    ),
  ].join('\r\n')

  await writeFile(outputPath, `${csv}\r\n`, 'utf8')
}

async function main() {
  const args = parseArgs()
  const csvPath = path.resolve(args.file)
  const csv = await readFile(csvPath, 'utf8')
  const rows = parseCsv(csv)

  assertRequiredRows(rows)

  const itemCodes = uniqueValues(rows.map((row) => row.item_product_code))
  const setCodes = uniqueValues(rows.map((row) => row.set_product_code))
  const supabase = createServiceClient()
  const matchesBySku = await loadPaintMatches(supabase, itemCodes)
  const resolvedPaintsBySku = resolvePaintIds(rows, matchesBySku)

  const summary = {
    file: csvPath,
    dryRun: args.dryRun,
    sets: setCodes.length,
    itemRows: rows.length,
    uniqueItemSkus: itemCodes.length,
    resolvedPaints: resolvedPaintsBySku.size,
    resolvedOutput: args.resolvedOutput ? path.resolve(args.resolvedOutput) : null,
  }

  if (args.resolvedOutput) {
    await writeResolvedCsv({
      outputPath: path.resolve(args.resolvedOutput),
      rows,
      paintsByResolutionKey: resolvedPaintsBySku,
    })
  }

  if (args.dryRun) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const paintSetsByProductCode = await upsertPaintSets(supabase, rows)

  if (args.replaceItems) {
    await deleteExistingPaintSetItems(supabase, paintSetsByProductCode)
  }

  await upsertPaintSetItems(
    supabase,
    rows,
    paintSetsByProductCode,
    resolvedPaintsBySku
  )

  console.log(
    JSON.stringify(
      {
        ...summary,
        replacedItems: args.replaceItems,
        importedSets: paintSetsByProductCode.size,
        importedItems: rows.length,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
