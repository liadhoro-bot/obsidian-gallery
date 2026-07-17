import { existsSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

type CatalogRow = {
  brand: string | null
  line: string | null
  sku: string | null
  name: string | null
}

const outputPath = path.join(
  process.cwd(),
  'downloads',
  'reference',
  'paint-catalog-brand-lines.csv'
)

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue

    const [, rawKey, rawValue] = match
    const key = rawKey.trim()

    if (process.env[key]) continue

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
  }
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? '')

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

loadDotEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before exporting catalog lines.'
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const rows: CatalogRow[] = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('brand,line,sku,name')
      .eq('is_active', true)
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error

    rows.push(...((data ?? []) as CatalogRow[]))

    if (!data || data.length < pageSize) break
  }

  const byLine = new Map<
    string,
    {
      brand: string
      line: string
      catalog_paint_count: number
      sample_skus: string[]
      sample_names: string[]
    }
  >()

  for (const row of rows) {
    const brand = row.brand ?? ''
    const line = row.line ?? ''
    const key = `${brand}\t${line}`
    const current =
      byLine.get(key) ??
      {
        brand,
        line,
        catalog_paint_count: 0,
        sample_skus: [],
        sample_names: [],
      }

    current.catalog_paint_count += 1
    if (row.sku && current.sample_skus.length < 5) current.sample_skus.push(row.sku)
    if (row.name && current.sample_names.length < 5) current.sample_names.push(row.name)
    byLine.set(key, current)
  }

  const columns = [
    'brand',
    'line',
    'catalog_paint_count',
    'sample_skus',
    'sample_names',
  ]
  const csv = [
    columns.join(','),
    ...Array.from(byLine.values())
      .sort(
        (a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line)
      )
      .map((row) =>
        [
          row.brand,
          row.line,
          row.catalog_paint_count,
          row.sample_skus.join('|'),
          row.sample_names.join('|'),
        ]
          .map(csvValue)
          .join(',')
      ),
  ].join('\r\n')

  await writeFile(outputPath, `${csv}\r\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        outputPath,
        catalogPaints: rows.length,
        brandLines: byLine.size,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
