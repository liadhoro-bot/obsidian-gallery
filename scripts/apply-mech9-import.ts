/**
 * Writes the mech9 Vallejo cross-reference built by build-mech9-imports.ts.
 *
 *   npx tsx --env-file=.env.local scripts/apply-mech9-import.ts
 *
 * 1. Inserts paints missing from lines we already carry (skipping existing ones).
 * 2. Imports the pairings as one community source (connection_type
 *    community_equivalent, ranked below official charts).
 *
 * Writes scripts/output/mech9-import-applied.json for rollback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { hexToLab, isUsableHex } from '../utils/paint-conversions/color'
import { normalizeBrand, normalizeLine, normalizePaintName } from '../utils/paint-conversions/normalization'
import { importConversionCsv } from '../utils/paint-conversions/service'
import { createScriptClient } from './lib/script-supabase'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'mech9', 'import')
const APPLIED = path.join(process.cwd(), 'scripts', 'output', 'mech9-import-applied.json')

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
  const applied: Record<string, unknown> = { at: new Date().toISOString() }

  const paints = readCsv('new-paints.csv')
  const rows = []
  for (const paint of paints) {
    const { data: existing, error } = await supabase
      .from('paint_catalog')
      .select('id')
      .eq('brand', paint.brand)
      .eq('line', paint.line)
      .eq('normalized_name', normalizePaintName(paint.name))
      .limit(1)
    if (error) throw error
    if (existing?.length) continue

    const hex = isUsableHex(paint.hex) ? paint.hex.toUpperCase() : null
    const lab = hex ? hexToLab(hex) : null
    const utility = paint.paint_type === 'auxiliary'
    rows.push({
      id: randomUUID(),
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku || null,
      swatch_image_url: null,
      hex_approx: hex,
      hex_source: hex ? 'community_chart' : null,
      hex_checked_at: hex ? new Date().toISOString() : null,
      finish: paint.paint_type === 'metallic' ? 'metallic' : 'matte',
      finish_type: paint.paint_type === 'metallic' ? 'metallic' : 'standard',
      paint_type: paint.paint_type,
      is_active: true,
      color_match_enabled: !utility && hex !== null,
      color_match_exclude_reason: utility ? 'Utility product imported from a community cross-reference.' : null,
      is_color_matchable: !utility && hex !== null,
      is_conversion_matchable: true,
      normalized_brand: normalizeBrand(paint.brand),
      normalized_line: normalizeLine(paint.line),
      normalized_name: normalizePaintName(paint.name),
      lab_l: lab?.l ?? null,
      lab_a: lab?.a ?? null,
      lab_b: lab?.b ?? null,
      barcode_aliases: [],
    })
  }
  if (rows.length) {
    const { error } = await supabase.from('paint_catalog').insert(rows)
    if (error) throw error
  }
  applied.inserted_paint_ids = rows.map((r) => r.id)
  console.log(`inserted ${rows.length} paints`)
  fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))

  // Re-runs append only pairings not imported before, under the same source.
  const { data: existingSource } = await supabase
    .from('paint_conversion_sources')
    .select('id')
    .eq('name', 'mech9 Vallejo paint conversion tables')
    .maybeSingle()
  const imported = new Set<string>()
  if (existingSource) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('paint_conversion_raw_rows')
        .select('source_brand_raw, source_line_raw, source_paint_name_raw, target_brand_raw, target_line_raw, target_paint_name_raw')
        .eq('source_id', existingSource.id)
        .range(from, from + 999)
      if (error) throw error
      for (const r of data) imported.add([r.source_brand_raw, r.source_line_raw, r.source_paint_name_raw, r.target_brand_raw, r.target_line_raw, r.target_paint_name_raw].join('|'))
      if (data.length < 1000) break
    }
  }
  const chartRows = readCsv('chart-rows.csv').filter(
    (r) => !imported.has([r.source_brand, r.source_line, r.source_name, r.target_brand, r.target_line, r.target_name].join('|'))
  )
  console.log(`${chartRows.length} pairings not imported yet`)
  const result = await importConversionCsv(
    supabase,
    chartRows.map((r) => ({
      source_brand_raw: r.source_brand,
      source_line_raw: r.source_line,
      source_paint_name_raw: r.source_name,
      target_brand_raw: r.target_brand,
      target_line_raw: r.target_line,
      target_paint_name_raw: r.target_name,
      notes_raw: [r.notes, `codes ${r.source_code || '-'} / ${r.target_code || '-'}`].filter(Boolean).join('; '),
    })),
    {
      name: 'mech9 Vallejo paint conversion tables',
      manufacturer: null,
      source_type: 'community_chart',
      source_url: 'https://www.mech9.com/p/vallejo-paint-conversion-chart.html',
      file_path: 'data/conversion-charts/mech9/vallejo-cross-reference.csv',
      notes: 'Community-compiled; mech9 states the tables are collated from paint manufacturers\' comparison charts. Extracted 2026-10-08.',
      reliability_score: 0.7,
      existing_source_id: existingSource?.id,
    }
  )
  applied.source = result
  fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))
  console.log(`mech9: ${result.matched_rows}/${result.inserted_rows} matched, ${result.review_rows} review, ${result.edges_created} edges`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
