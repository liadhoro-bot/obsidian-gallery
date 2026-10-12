/**
 * Applies build-ak-imports.ts:
 *   1. Inserts the new paints (AK Real Colors, Tamiya Color Acrylic Paint,
 *      missing Vallejo codes), uploading their swatches to
 *      paint-swatches/<brand>/<line>/<sku>.png.
 *   2. Re-types colours that an earlier import mistook for mediums
 *      ("Medium Gunship Grey" typed auxiliary), so they colour-match again.
 *   3. Imports AK's 3rd Gen and Real Color charts as two official sources.
 *      Re-runs append only rows not imported yet.
 *
 *   npx tsx --env-file=.env.local scripts/apply-ak-import.ts
 *
 * Writes scripts/output/ak-import-applied.json for rollback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createScriptClient } from './lib/script-supabase'
import { hexToLab } from '../utils/paint-conversions/color'
import { importConversionCsv } from '../utils/paint-conversions/service'
import { normalizeBrand, normalizeLine, normalizePaintName } from '../utils/paint-conversions/normalization'

const ROOT = process.cwd()
const DIR = path.join(ROOT, 'data', 'conversion-charts', 'ak-interactive', 'import')
const APPLIED = path.join(ROOT, 'scripts', 'output', 'ak-import-applied.json')
const supabase = createScriptClient()
const UTILITY_TYPES = new Set(['varnish', 'auxiliary'])
const COLOUR_NAMED_MEDIUM = /\bmedium\s+(?!matte?\b|\d)[a-z]/i

const SOURCES = [
  {
    file: '3gen-rows.csv',
    name: 'AK Interactive 3rd Generation Equivalence Table (2023)',
    file_path: 'data/conversion-charts/ak-interactive/3gen-equivalence.csv',
    notes: 'EQUIVALENCIAS2023.pdf: AK 3rd Gen acrylics to Vallejo Model Color / Game Color and Citadel. Old Citadel names and three misprinted rows skipped.',
  },
  {
    file: 'real-color-rows.csv',
    name: 'AK Interactive Real Colors Conversion Chart',
    file_path: 'data/conversion-charts/ak-interactive/real-color-conversion.csv',
    notes: 'RCEquivalenceDIG.pdf: Real Colors to Vallejo and Tamiya acrylics. The chart uses the old RC001-RC508 numbering, mapped to the current range by name (import/real-color-renumbering.csv).',
  },
]

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

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

async function main() {
  const applied: Record<string, unknown> = { at: new Date().toISOString() }

  // 1. New paints.
  const existing = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('brand, sku').range(from, from + 999)
    if (error) throw error
    for (const p of data) existing.add(`${p.brand}|${p.sku}`)
    if (data.length < 1000) break
  }

  const rows = []
  let uploaded = 0
  for (const paint of readCsv('new-paints.csv')) {
    if (existing.has(`${paint.brand}|${paint.sku}`)) continue

    let swatchUrl: string | null = null
    if (paint.swatch_file && fs.existsSync(path.join(ROOT, paint.swatch_file))) {
      const objectPath = `${slug(paint.brand)}/${slug(paint.line)}/${slug(paint.sku)}.png`
      const { error } = await supabase.storage
        .from('paint-swatches')
        .upload(objectPath, fs.readFileSync(path.join(ROOT, paint.swatch_file)), { contentType: 'image/png', upsert: true })
      if (error) throw error
      swatchUrl = supabase.storage.from('paint-swatches').getPublicUrl(objectPath).data.publicUrl
      uploaded += 1
    }

    const lab = paint.hex ? hexToLab(paint.hex) : null
    const utility = UTILITY_TYPES.has(paint.paint_type) || !paint.hex
    rows.push({
      id: randomUUID(),
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      swatch_image_url: swatchUrl,
      hex_approx: paint.hex || null,
      hex_source: paint.hex_source || null,
      hex_checked_at: paint.hex ? new Date().toISOString() : null,
      finish: paint.finish || null,
      finish_type: paint.finish_type || 'standard',
      paint_type: paint.paint_type,
      is_active: true,
      color_match_enabled: !utility,
      color_match_exclude_reason: utility ? 'Utility product (varnish, thinner or base).' : null,
      is_color_matchable: !utility,
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
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('paint_catalog').insert(rows.slice(i, i + 100))
    if (error) throw error
  }
  applied.inserted_paint_ids = rows.map((r) => r.id)
  console.log(`uploaded ${uploaded} swatches, inserted ${rows.length} paints`)

  // 2. Colours typed as mediums.
  const { data: auxiliary, error: auxError } = await supabase
    .from('paint_catalog')
    .select('id, line, name, paint_type, color_match_enabled, color_match_exclude_reason, is_color_matchable, hex_approx')
    .eq('paint_type', 'auxiliary')
  if (auxError) throw auxError
  const retyped = (auxiliary ?? []).filter((p) => COLOUR_NAMED_MEDIUM.test(p.name) && p.hex_approx)
  for (const p of retyped) {
    const { error } = await supabase
      .from('paint_catalog')
      .update({
        paint_type: /\bair\b/i.test(p.line) ? 'air' : 'acrylic',
        color_match_enabled: true,
        color_match_exclude_reason: null,
        is_color_matchable: true,
      })
      .eq('id', p.id)
    if (error) throw error
  }
  applied.retyped = retyped
  console.log(`re-typed ${retyped.length} colours named "Medium …":`, retyped.map((p) => `${p.line} ${p.name}`).join('; '))

  // 3. Charts.
  applied.sources = []
  for (const spec of SOURCES) {
    const { data: existingSource } = await supabase.from('paint_conversion_sources').select('id').eq('name', spec.name).maybeSingle()
    const imported = new Set<string>()
    if (existingSource) {
      const { data, error } = await supabase
        .from('paint_conversion_raw_rows')
        .select('source_code_raw, source_paint_name_raw, target_code_raw, target_paint_name_raw')
        .eq('source_id', existingSource.id)
      if (error) throw error
      for (const r of data) imported.add([r.source_code_raw, r.source_paint_name_raw, r.target_code_raw, r.target_paint_name_raw].join('|'))
    }
    const pairs = readCsv(spec.file).filter(
      (r) => !imported.has([r.source_code || null, r.source_name, r.target_code || null, r.target_name].join('|'))
    )
    console.log(`${spec.name}: ${pairs.length} pairings not imported yet`)
    if (pairs.length === 0) continue

    const result = await importConversionCsv(
      supabase,
      pairs.map((r) => ({
        source_brand_raw: r.source_brand,
        source_line_raw: r.source_line,
        source_paint_name_raw: r.source_name,
        source_code_raw: r.source_code || null,
        target_brand_raw: r.target_brand,
        target_line_raw: r.target_line,
        target_paint_name_raw: r.target_name,
        target_code_raw: r.target_code || null,
        notes_raw: r.notes || null,
      })),
      {
        name: spec.name,
        manufacturer: 'AK Interactive',
        source_type: 'official_chart',
        source_url: 'https://ak-interactive.com/',
        file_path: spec.file_path,
        notes: spec.notes,
        reliability_score: 1,
        existing_source_id: existingSource?.id,
      }
    )
    ;(applied.sources as unknown[]).push({ name: spec.name, result })
    console.log(`  ${result.matched_rows}/${result.inserted_rows} matched, ${result.review_rows} review, ${result.edges_created} edges`)
  }

  fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
