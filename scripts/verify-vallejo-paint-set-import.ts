import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CsvRow = Record<string, string>

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    if (!process.env[key]) {
      process.env[key] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

function parseCsv(csvPath: string) {
  const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((line) => line.trim())
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])) as CsvRow
  })
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

async function main() {
  loadDotEnvLocal()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase env.')

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const rows = parseCsv(path.join(process.cwd(), 'downloads', 'reference', 'vallejo-paint-sets-import-clean.csv'))
  const expectedByCode = new Map<string, number>()
  for (const row of rows) {
    expectedByCode.set(row.set_product_code, (expectedByCode.get(row.set_product_code) ?? 0) + 1)
  }

  const { data: sets, error: setsError } = await supabase
    .from('paint_sets')
    .select('id, product_code, name')
    .eq('brand', 'Vallejo')
  if (setsError) throw new Error(setsError.message)

  const setIds = (sets ?? []).map((set) => set.id as string)
  const items: Array<{ id: string; paint_set_id: string; source_product_code: string; item_role: string | null }> = []
  for (const chunk of chunkArray(setIds, 100)) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('paint_set_items')
        .select('id, paint_set_id, source_product_code, item_role')
        .in('paint_set_id', chunk)
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      items.push(...((data ?? []) as typeof items))
      if (!data || data.length < 1000) break
    }
  }

  const dbCountBySetId = new Map<string, number>()
  for (const item of items) {
    dbCountBySetId.set(item.paint_set_id, (dbCountBySetId.get(item.paint_set_id) ?? 0) + 1)
  }

  const diffs = (sets ?? [])
    .map((set) => ({
      id: set.id as string,
      product_code: set.product_code as string,
      name: set.name as string,
      db_count: dbCountBySetId.get(set.id as string) ?? 0,
      csv_count: expectedByCode.get(set.product_code as string) ?? 0,
    }))
    .filter((set) => set.db_count !== set.csv_count)
    .sort((a, b) => a.product_code.localeCompare(b.product_code))

  console.log(
    JSON.stringify(
      {
        csvSets: expectedByCode.size,
        csvItems: rows.length,
        dbSets: sets?.length ?? 0,
        dbItems: items.length,
        diffs,
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
