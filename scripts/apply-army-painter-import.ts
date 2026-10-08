/**
 * Writes the Army Painter chart import built by build-army-painter-imports.ts
 * and the swatches from make-army-painter-swatches.mjs to the database.
 *
 *   npx tsx --env-file=.env.local scripts/apply-army-painter-import.ts
 *
 * 1. Renames catalog paints listed in import/renames.json.
 * 2. Uploads swatch PNGs to storage (paint-swatches/army-painter/<line>/<sku>.png).
 * 3. Inserts new catalog paints (skipping any that already exist).
 * 4. Retires the June 2026 mis-parsed Fanatic chart import (edges deactivated).
 * 5. Imports every chart as its own conversion source.
 *
 * Writes scripts/output/army-painter-import-applied.json for rollback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { hexToLab } from '../utils/paint-conversions/color'
import { normalizeBrand, normalizeLine, normalizePaintName } from '../utils/paint-conversions/normalization'
import { importConversionCsv } from '../utils/paint-conversions/service'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'army-painter', 'import')
const SWATCHES = path.join(process.cwd(), 'scripts', 'output', 'army-painter-swatches')
const APPLIED = path.join(process.cwd(), 'scripts', 'output', 'army-painter-import-applied.json')
const OLD_FANATIC_SOURCE = '860099d8-a307-4169-a188-cd67943d5a4f'
const UTILITY_TYPES = new Set(['primer', 'varnish', 'auxiliary'])

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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

const lineSlug = (line: string) => line.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const applied: Record<string, unknown> = { at: new Date().toISOString() }

  // 1. Renames.
  const renames = JSON.parse(fs.readFileSync(path.join(DIR, 'renames.json'), 'utf8')) as Array<{ brand: string; line: string; from: string; to: string }>
  applied.renamed = []
  for (const rename of renames) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .update({ name: rename.to, normalized_name: normalizePaintName(rename.to) })
      .eq('brand', rename.brand)
      .eq('line', rename.line)
      .eq('name', rename.from)
      .select('id')
    if (error) throw error
    ;(applied.renamed as unknown[]).push({ ...rename, ids: data?.map((r) => r.id) })
    console.log(`renamed ${rename.from} -> ${rename.to}: ${data?.length ?? 0}`)
  }

  // 2 + 3. Swatches and new paints.
  const paints = readCsv('new-paints.csv')
  const existing = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('brand, line, name').eq('brand', 'Army Painter').range(from, from + 999)
    if (error) throw error
    for (const p of data) existing.add(`${p.line}|${normalizePaintName(p.name)}`)
    if (data.length < 1000) break
  }

  const rows = []
  let uploaded = 0
  for (const paint of paints) {
    if (existing.has(`${paint.line}|${normalizePaintName(paint.name)}`)) continue

    let swatchUrl: string | null = null
    const file = path.join(SWATCHES, `${paint.sku}.png`)
    if (fs.existsSync(file)) {
      const objectPath = `army-painter/${lineSlug(paint.line)}/${paint.sku.toLowerCase()}.png`
      const { error } = await supabase.storage.from('paint-swatches').upload(objectPath, fs.readFileSync(file), { contentType: 'image/png', upsert: true })
      if (error) throw error
      swatchUrl = supabase.storage.from('paint-swatches').getPublicUrl(objectPath).data.publicUrl
      uploaded += 1
    }

    const lab = hexToLab(paint.hex)
    const utility = UTILITY_TYPES.has(paint.paint_type)
    rows.push({
      id: randomUUID(),
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      swatch_image_url: swatchUrl,
      hex_approx: paint.hex,
      hex_source: paint.hex_source,
      hex_checked_at: new Date().toISOString(),
      finish: paint.paint_type === 'metallic' ? 'metallic' : paint.paint_type === 'varnish' ? 'varnish' : 'matte',
      finish_type: paint.paint_type === 'metallic' ? 'metallic' : paint.paint_type === 'varnish' ? 'varnish' : 'standard',
      paint_type: paint.paint_type,
      is_active: true,
      color_match_enabled: !utility,
      color_match_exclude_reason: utility ? 'Utility product imported from an Army Painter colour chart.' : null,
      is_color_matchable: !utility,
      is_conversion_matchable: true,
      normalized_brand: normalizeBrand(paint.brand),
      normalized_line: normalizeLine(paint.line),
      normalized_name: normalizePaintName(paint.name),
      lab_l: lab.l,
      lab_a: lab.a,
      lab_b: lab.b,
      barcode_aliases: [],
    })
  }

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('paint_catalog').insert(rows.slice(i, i + 100))
    if (error) throw error
  }
  applied.inserted_paint_ids = rows.map((r) => r.id)
  applied.inserted_skus = rows.map((r) => r.sku)
  console.log(`uploaded ${uploaded} swatches, inserted ${rows.length} paints`)
  fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))

  // 4. Retire the mis-parsed June import of the Fanatic chart.
  const { data: retired, error: retireError } = await supabase
    .from('paint_conversion_edges')
    .update({ is_active: false, needs_review: true, updated_at: new Date().toISOString() })
    .eq('source_id', OLD_FANATIC_SOURCE)
    .eq('is_active', true)
    .select('id')
  if (retireError) throw retireError
  const { error: noteError } = await supabase
    .from('paint_conversion_sources')
    .update({ notes: 'Superseded 2026-10-08 by the position-based re-extraction (columns were mis-parsed). Edges deactivated.' })
    .eq('id', OLD_FANATIC_SOURCE)
  if (noteError) throw noteError
  applied.retired_edge_ids = retired?.map((e) => e.id)
  console.log(`retired ${retired?.length ?? 0} edges from the June Fanatic import`)

  // 5. Import each chart as its own source.
  const chartRows = readCsv('chart-rows.csv')
  const charts = [...new Set(chartRows.map((r) => r.chart))]
  applied.sources = []
  for (const chart of charts) {
    const rowsForChart = chartRows.filter((r) => r.chart === chart)
    const result = await importConversionCsv(
      supabase,
      rowsForChart.map((r) => ({
        source_brand_raw: r.source_brand,
        source_line_raw: r.source_line,
        source_paint_name_raw: r.source_name,
        target_brand_raw: r.target_brand,
        target_line_raw: r.target_line,
        target_paint_name_raw: r.target_name,
        notes_raw: [r.section, r.notes].filter(Boolean).join('; ') || null,
      })),
      {
        name: chart,
        manufacturer: 'The Army Painter',
        source_type: 'official_chart',
        source_url: rowsForChart[0].chart_url,
        file_path: 'data/conversion-charts/army-painter/import/chart-rows.csv',
        notes: 'Extracted 2026-10-07 by position from the official PDF; see data/conversion-charts/army-painter/README.md.',
        reliability_score: 1,
      }
    )
    ;(applied.sources as unknown[]).push({ chart, ...result })
    fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))
    console.log(`${chart}: ${result.matched_rows}/${result.inserted_rows} matched, ${result.edges_created} edges`)
  }

  console.log(`done; rollback record in ${APPLIED}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
