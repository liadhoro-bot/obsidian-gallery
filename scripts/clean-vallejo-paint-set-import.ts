import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CsvRow = Record<string, string>
type CatalogImportRow = CsvRow & { item_line: string }

type PaintCatalogMatch = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
}

const inputPath = path.join(process.cwd(), 'downloads', 'reference', 'vallejo-paint-sets.csv')
const outputPath = path.join(process.cwd(), 'downloads', 'reference', 'vallejo-paint-sets-import-clean.csv')
const reportPath = path.join(process.cwd(), 'downloads', 'reference', 'vallejo-paint-sets-import-clean-report.json')

const TRUE_METALLIC_ROLE_LINES = new Map([
  ['Light', 'True Metallic Metal Light'],
  ['Base', 'True Metallic Metal Base'],
  ['Shade', 'True Metallic Metal Shade'],
  ['Airbrush', 'True Metallic Metal Airbrush'],
])

const outputColumns = [
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

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue
    const [, rawKey, rawValue] = match
    const key = rawKey.trim()
    if (!process.env[key]) {
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
    }
  }
}

function createServiceClient() {
  loadDotEnvLocal()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells
}

function parseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])) as CsvRow
  })
}

function csvValue(value: unknown) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function normalized(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

function inferItemLine(row: CsvRow) {
  const sku = row.item_product_code
  const prefix = sku.slice(0, 2)
  const numeric = Number(sku.slice(3))
  const setLine = row.line
  const sourceUrl = row.set_source_url.toLowerCase()
  const setName = row.set_name.toLowerCase()

  if (row.line === 'True Metallic Metal') {
    return TRUE_METALLIC_ROLE_LINES.get(row.item_role) ?? row.line
  }

  if (prefix === '26') return 'Diorama FX'
  if (prefix === '62') return 'Premium Color'
  if (prefix === '69') return 'Mecha Color'
  if (prefix === '74') return 'Weathering FX'
  if (prefix === '76' && numeric >= 800) return 'Weathering FX'
  if (prefix === '76') return 'Game Air'
  if (prefix === '77' && numeric >= 700) return 'Metal Color'
  if (prefix === '77' && numeric >= 90 && numeric <= 99) return 'Eccentric Colors - The Shifters'
  if (prefix === '77') return 'Liquid Metal'
  if (prefix === '80') return 'WizKids'

  if (sku === '70.510' || sku === '70.520' || sku === '70.521' || sku === '70.522' || sku === '70.524' || sku === '70.596') {
    return setLine === 'Game Color' ? 'Game Color Auxilary' : 'Model Color Auxiliary'
  }

  if (sku === '71.261' || sku === '71.262') {
    if (setLine === 'Mecha Color') return 'Mecha Auxiliaries'
    if (setLine === 'Game Color' || setLine === 'Game Air') return 'Game Color Auxilary'
    return 'Model Color Auxiliary'
  }

  if (sku === '73.212' || sku === '73.214') {
    return setLine === 'Mecha Color' ? 'Mecha Auxiliaries' : 'Model Color Auxiliary'
  }

  if (prefix === '73') {
    if (numeric >= 200 && numeric <= 210) return 'Game Color Wash'
    if (numeric >= 800) return 'Pigment FX'
    return 'Pigment FX'
  }

  if (prefix === '72') {
    if (numeric >= 650 && numeric <= 699) return 'Game Color Auxilary'
    if (sourceUrl.includes('xpress') || setName.includes('xpress')) return 'Xpress Color'
    return 'Game Color'
  }

  if (prefix === '71') return 'Model Air'
  if (prefix === '70') return 'Model Color'
  if (prefix === '79') return 'Model Color'

  return setLine
}

function candidateNameForInsert(row: CsvRow) {
  if (row.line === 'True Metallic Metal' && row.item_role) {
    return `${row.item_name} ${row.item_role}`
  }
  return row.item_name
}

async function loadMatches(
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

function pickMatch(row: CsvRow, matches: PaintCatalogMatch[], itemLine: string) {
  const lineMatches = matches.filter((match) => match.brand === row.brand && match.line === itemLine)
  if (lineMatches.length === 1) return lineMatches[0]

  const expectedName = normalized(candidateNameForInsert(row))
  const nameMatches = matches.filter((match) => match.brand === row.brand && normalized(match.name) === expectedName)
  if (nameMatches.length === 1) return nameMatches[0]

  return null
}

async function insertMissingCatalogRows(
  supabase: ReturnType<typeof createServiceClient>,
  rows: CatalogImportRow[],
  matchesBySku: Map<string, PaintCatalogMatch[]>
) {
  const missingByKey = new Map<string, CatalogImportRow>()

  for (const row of rows) {
    const match = pickMatch(row, matchesBySku.get(row.item_product_code) ?? [], row.item_line)
    if (!match) {
      missingByKey.set(`${row.item_product_code}\u0000${row.item_line}`, row)
    }
  }

  const inserts = Array.from(missingByKey.values()).map((row) => ({
    brand: 'Vallejo',
    line: row.item_line,
    name: candidateNameForInsert(row),
    sku: row.item_product_code,
    paint_type: 'acrylic',
    is_active: true,
    normalized_brand: 'vallejo',
    normalized_line: normalized(row.item_line),
    normalized_name: normalized(candidateNameForInsert(row)),
    color_match_enabled: false,
    color_match_exclude_reason: 'Imported as paint-set catalogue placeholder; swatch/color data not verified.',
    is_color_matchable: false,
    is_conversion_matchable: false,
    finish_type: row.item_line.includes('Metal') ? 'metallic' : 'standard',
  }))

  for (const chunk of chunkArray(inserts, 100)) {
    const { error } = await supabase.from('paint_catalog').insert(chunk)
    if (error) throw new Error(error.message)
  }

  return inserts.length
}

function cleanNameForImporter(row: CsvRow, match: PaintCatalogMatch) {
  const name = match.name ?? row.item_name
  if (row.line !== 'True Metallic Metal' || !row.item_role) return name
  return name.replace(new RegExp(`\\s+${row.item_role}$`, 'i'), '')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const shouldSyncCatalog = args.has('--sync-catalog')
  const supabase = createServiceClient()
  const rows: CatalogImportRow[] = parseCsv(readFileSync(inputPath, 'utf8')).map(
    (row) => ({
      ...row,
      item_line: inferItemLine(row),
    })
  )

  let matchesBySku = await loadMatches(supabase, uniqueValues(rows.map((row) => row.item_product_code)))
  const insertedCatalogRows = shouldSyncCatalog
    ? await insertMissingCatalogRows(supabase, rows, matchesBySku)
    : 0

  if (insertedCatalogRows > 0) {
    matchesBySku = await loadMatches(supabase, uniqueValues(rows.map((row) => row.item_product_code)))
  }

  const unresolved: Array<Record<string, string>> = []
  const cleanedRows = rows.map((row) => {
    const match = pickMatch(row, matchesBySku.get(row.item_product_code) ?? [], row.item_line)
    if (!match) {
      unresolved.push({
        set_product_code: row.set_product_code,
        set_name: row.set_name,
        item_product_code: row.item_product_code,
        item_name: row.item_name,
        item_line: row.item_line,
      })
      return row
    }

    return {
      ...row,
      item_name: cleanNameForImporter(row, match),
    }
  })

  if (unresolved.length) {
    throw new Error(`Could not resolve ${unresolved.length} rows; see ${reportPath}`)
  }

  writeFileSync(
    outputPath,
    [
      outputColumns.join(','),
      ...cleanedRows.map((row) => outputColumns.map((column) => csvValue(row[column] ?? '')).join(',')),
    ].join('\r\n') + '\r\n'
  )

  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        inputPath,
        outputPath,
        rows: cleanedRows.length,
        sets: uniqueValues(cleanedRows.map((row) => row.set_product_code)).length,
        uniqueItemSkus: uniqueValues(cleanedRows.map((row) => row.item_product_code)).length,
        insertedCatalogRows,
        unresolved,
        itemLines: cleanedRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.item_line] = (acc[row.item_line] ?? 0) + 1
          return acc
        }, {}),
      },
      null,
      2
    ) + '\n'
  )

  console.log(
    JSON.stringify(
      {
        outputPath,
        reportPath,
        rows: cleanedRows.length,
        sets: uniqueValues(cleanedRows.map((row) => row.set_product_code)).length,
        insertedCatalogRows,
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
