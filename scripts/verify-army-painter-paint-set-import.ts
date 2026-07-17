import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CsvRow = {
  set_product_code: string
  item_product_code: string
  quantity: string
}

type PaintSet = {
  id: string
  product_code: string | null
}

type PaintSetItem = {
  paint_set_id: string
  source_product_code: string | null
  quantity: number | null
}

const CSV_PATH = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'army-painter-paint-sets-import-clean.csv'
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
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running verification.'
    )
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
  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ''])
    ) as CsvRow
  })
}

function countBySetAndSku(rows: CsvRow[]) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const key = `${row.set_product_code}\u0000${row.item_product_code}`
    counts.set(key, (counts.get(key) ?? 0) + Math.max(1, Number(row.quantity || 1)))
  }

  return counts
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

async function main() {
  const rows = parseCsv(await readFile(CSV_PATH, 'utf8'))
  const csvSetCodes = Array.from(new Set(rows.map((row) => row.set_product_code))).sort()
  const supabase = createServiceClient()
  const paintSets: PaintSet[] = []

  for (const chunk of chunkArray(csvSetCodes, 100)) {
    const { data, error } = await supabase
      .from('paint_sets')
      .select('id, product_code')
      .eq('brand', 'Army Painter')
      .in('product_code', chunk)

    if (error) throw new Error(error.message)
    paintSets.push(...((data ?? []) as PaintSet[]))
  }

  const setCodeById = new Map(
    paintSets.map((paintSet) => [paintSet.id, paintSet.product_code ?? ''])
  )
  const setIdByCode = new Map(
    paintSets.map((paintSet) => [paintSet.product_code ?? '', paintSet.id])
  )
  const paintSetItems: PaintSetItem[] = []

  for (const chunk of chunkArray(Array.from(setCodeById.keys()), 100)) {
    const { data, error } = await supabase
      .from('paint_set_items')
      .select('paint_set_id, source_product_code, quantity')
      .in('paint_set_id', chunk)

    if (error) throw new Error(error.message)
    paintSetItems.push(...((data ?? []) as PaintSetItem[]))
  }

  const csvCounts = countBySetAndSku(rows)
  const dbCounts = new Map<string, number>()

  for (const item of paintSetItems) {
    const setCode = setCodeById.get(item.paint_set_id)
    if (!setCode || !item.source_product_code) continue

    const key = `${setCode}\u0000${item.source_product_code}`
    dbCounts.set(key, (dbCounts.get(key) ?? 0) + Math.max(1, Number(item.quantity || 1)))
  }

  const diffs: string[] = []

  for (const setCode of csvSetCodes) {
    if (!setIdByCode.has(setCode)) {
      diffs.push(`Missing DB paint_set ${setCode}`)
    }
  }

  for (const [key, csvQuantity] of csvCounts.entries()) {
    const dbQuantity = dbCounts.get(key)
    if (dbQuantity !== csvQuantity) {
      diffs.push(`${key.replace('\u0000', ' / ')} quantity CSV=${csvQuantity} DB=${dbQuantity ?? 0}`)
    }
  }

  for (const [key, dbQuantity] of dbCounts.entries()) {
    if (!csvCounts.has(key)) {
      diffs.push(`${key.replace('\u0000', ' / ')} extra DB quantity=${dbQuantity}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        csvSets: csvSetCodes.length,
        csvRows: rows.length,
        dbSets: paintSets.length,
        dbRows: paintSetItems.length,
        diffs,
      },
      null,
      2
    )
  )

  if (diffs.length) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
