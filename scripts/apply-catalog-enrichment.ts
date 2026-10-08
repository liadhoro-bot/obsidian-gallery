/**
 * Applies the safe parts of build-catalog-enrichment.ts:
 *   - official product codes in place of made-up "AP-…" SKUs
 *   - chart spellings as paint_aliases (future imports match them exactly)
 *   - current paints the charts reference that we lacked
 * Hex second opinions are not applied here; they go through review.
 *
 *   npx tsx --env-file=.env.local scripts/apply-catalog-enrichment.ts
 *
 * Writes scripts/output/catalog-enrichment-applied.json for rollback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createScriptClient } from './lib/script-supabase'
import { hexToLab } from '../utils/paint-conversions/color'
import { normalizeBrand, normalizeLine, normalizePaintName } from '../utils/paint-conversions/normalization'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'enrichment')
const APPLIED = path.join(process.cwd(), 'scripts', 'output', 'catalog-enrichment-applied.json')
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

  // 1. Official product codes (only where the SKU is still a made-up one).
  const codes = readCsv('product-codes.csv')
  const skuChanges = []
  for (const row of codes) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .update({ sku: row.new_sku })
      .eq('id', row.paint_id)
      .eq('sku', row.old_sku)
      .select('id')
    if (error) throw error
    if (data?.length) skuChanges.push({ id: row.paint_id, from: row.old_sku, to: row.new_sku })
  }
  applied.sku_changes = skuChanges
  console.log(`product codes: ${skuChanges.length}/${codes.length} updated`)

  // 2. Aliases.
  const aliases = readCsv('aliases.csv')
  const { data: existingAliases, error: aliasLookupError } = await supabase.from('paint_aliases').select('paint_id, normalized_alias_name')
  if (aliasLookupError) throw aliasLookupError
  const have = new Set((existingAliases ?? []).map((a) => `${a.paint_id}|${a.normalized_alias_name}`))
  const aliasRows = aliases
    .filter((a) => !have.has(`${a.paint_id}|${normalizePaintName(a.alias)}`))
    .map((a) => ({
      id: randomUUID(),
      paint_id: a.paint_id,
      alias_brand: a.brand,
      alias_line: null,
      alias_name: a.alias,
      normalized_alias_brand: normalizeBrand(a.brand),
      normalized_alias_line: null,
      normalized_alias_name: normalizePaintName(a.alias),
      source: `chart spelling (${a.source})`,
      confidence_score: 0.95,
    }))
  if (aliasRows.length) {
    const { error } = await supabase.from('paint_aliases').insert(aliasRows)
    if (error) throw error
  }
  applied.alias_ids = aliasRows.map((a) => a.id)
  console.log(`aliases: ${aliasRows.length} inserted`)

  // 3. Missing current paints.
  const missing = readCsv('missing-paints.csv')
  const paintRows = missing.map((p) => {
    const lab = hexToLab(p.hex)
    return {
      id: randomUUID(),
      brand: p.brand,
      line: p.line,
      name: p.name,
      sku: p.sku || null,
      swatch_image_url: null,
      hex_approx: p.hex.toUpperCase(),
      hex_source: 'community_chart',
      hex_checked_at: new Date().toISOString(),
      finish: 'matte',
      finish_type: 'standard',
      paint_type: 'acrylic',
      is_active: true,
      color_match_enabled: true,
      is_color_matchable: true,
      is_conversion_matchable: true,
      normalized_brand: normalizeBrand(p.brand),
      normalized_line: normalizeLine(p.line),
      normalized_name: normalizePaintName(p.name),
      lab_l: lab.l,
      lab_a: lab.a,
      lab_b: lab.b,
      barcode_aliases: [],
    }
  })
  if (paintRows.length) {
    const { error } = await supabase.from('paint_catalog').insert(paintRows)
    if (error) throw error
  }
  applied.inserted_paint_ids = paintRows.map((p) => p.id)
  console.log(`missing paints: ${paintRows.length} inserted`)

  fs.writeFileSync(APPLIED, JSON.stringify(applied, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
