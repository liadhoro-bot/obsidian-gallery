/**
 * Imports the DakkaDakka Paint Range Compatibility Chart pairings built by
 * build-dakka-imports.ts as one community source (community_equivalent,
 * ranked below official charts). Re-runs append only rows not imported yet.
 *
 *   npx tsx --env-file=.env.local scripts/apply-dakka-import.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { importConversionCsv } from '../utils/paint-conversions/service'
import { createScriptClient } from './lib/script-supabase'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'dakka', 'import')
const SOURCE_NAME = 'DakkaDakka Paint Range Compatibility Chart'
const supabase = createScriptClient()

function readCsv(file: string) {
  const [header, ...lines] = fs.readFileSync(path.join(DIR, file), 'utf8').trim().split(/\r?\n/)
  const columns = header.split(',')
  return lines.map((line) => {
    const cells: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = !quoted
      } else if (ch === ',' && !quoted) {
        cells.push(cell)
        cell = ''
      } else cell += ch
    }
    cells.push(cell)
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ''])) as Record<string, string>
  })
}

async function main() {
  const { data: existingSource } = await supabase.from('paint_conversion_sources').select('id').eq('name', SOURCE_NAME).maybeSingle()
  const imported = new Set<string>()
  if (existingSource) {
    const { data, error } = await supabase
      .from('paint_conversion_raw_rows')
      .select('source_brand_raw, source_line_raw, source_paint_name_raw, target_brand_raw, target_line_raw, target_paint_name_raw')
      .eq('source_id', existingSource.id)
    if (error) throw error
    for (const r of data) imported.add([r.source_brand_raw, r.source_line_raw, r.source_paint_name_raw, r.target_brand_raw, r.target_line_raw, r.target_paint_name_raw].join('|'))
  }

  const rows = readCsv('chart-rows.csv').filter(
    (r) => !imported.has([r.source_brand, r.source_line, r.source_name, r.target_brand, r.target_line, r.target_name].join('|'))
  )
  console.log(`${rows.length} pairings not imported yet`)

  const result = await importConversionCsv(
    supabase,
    rows.map((r) => ({
      source_brand_raw: r.source_brand,
      source_line_raw: r.source_line,
      source_paint_name_raw: r.source_name,
      target_brand_raw: r.target_brand,
      target_line_raw: r.target_line,
      target_paint_name_raw: r.target_name,
      notes_raw: r.notes || null,
    })),
    {
      name: SOURCE_NAME,
      manufacturer: null,
      source_type: 'community_chart',
      source_url: 'https://www.dakkadakka.com/wiki/en/Paint_Range_Compatibility_Chart',
      file_path: 'data/conversion-charts/dakka/paint-range-compatibility-chart.tsv',
      notes: 'Community wiki compiled from Vallejo equivalence PDFs and other sources. Cells the chart marks approximate, uncertain or poor were skipped. Captured 2026-10-08.',
      reliability_score: 0.6,
      existing_source_id: existingSource?.id,
    }
  )
  console.log(`dakka: ${result.matched_rows}/${result.inserted_rows} matched, ${result.review_rows} review, ${result.edges_created} edges`)
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'output', 'dakka-import-applied.json'), JSON.stringify({ at: new Date().toISOString(), result }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
