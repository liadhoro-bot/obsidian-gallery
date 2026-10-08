/**
 * Mines the imported conversion charts for catalog enrichment. Read-only.
 *
 *   data/conversion-charts/enrichment/product-codes.csv    official codes for paints that only have made-up SKUs
 *   data/conversion-charts/enrichment/aliases.csv          chart spellings that needed a correction to match
 *   data/conversion-charts/enrichment/hex-second-opinion.csv  our hex vs the hex printed by mech9 (flag ΔE00 > 15)
 *   data/conversion-charts/enrichment/missing-paints.csv   current paints the charts reference that we lack
 *
 *   npx tsx --env-file=.env.local scripts/build-catalog-enrichment.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from './lib/script-supabase'
import { deltaE2000, hexToLab, isUsableHex } from '../utils/paint-conversions/color'
import { normalizePaintName } from '../utils/paint-conversions/normalization'

const ROOT = path.join(process.cwd(), 'data', 'conversion-charts')
const OUT = path.join(ROOT, 'enrichment')

type Paint = { id: string; brand: string; line: string; name: string; sku: string | null; hex_approx: string | null; hex_source: string | null }

function readCsv(file: string) {
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/)
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

// 1 - normalised edit distance, ignoring spaces ("Great Coat" vs "Greatcoat").
function similarity(a: string, b: string) {
  const x = a.replace(/\s+/g, '')
  const y = b.replace(/\s+/g, '')
  const row = Array.from({ length: y.length + 1 }, (_, i) => i)
  for (let i = 1; i <= x.length; i += 1) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= y.length; j += 1) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return 1 - row[y.length] / Math.max(x.length, y.length, 1)
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const cell = (v: unknown) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

async function main() {
  const supabase = createScriptClient()
  const catalog: Paint[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('id, brand, line, name, sku, hex_approx, hex_source').eq('is_active', true).order('id').range(from, from + 999)
    if (error) throw error
    catalog.push(...(data as Paint[]))
    if (data.length < 1000) break
  }
  const find = (brand: string, line: string, name: string) =>
    catalog.find((p) => p.brand === brand && p.line === line && normalizePaintName(p.name) === normalizePaintName(name))
  const mech9 = readCsv(path.join(ROOT, 'mech9', 'vallejo-cross-reference.csv'))

  // 1. Official Army Painter codes (mech9 prints them; ours are made up: AP-…).
  const TAP_RANGES: Record<string, string> = { Warpaints: 'Original Warpaints', 'Warpaints Fanatic': 'Warpaints Fanatic', 'Warpaints Air': 'Warpaints Air' }
  const codes = new Map<string, { paint: Paint; code: string }>()
  const conflicts: string[] = []
  for (const row of mech9) {
    for (const side of ['source', 'target'] as const) {
      const line = TAP_RANGES[row[`${side}_range`]]
      const code = row[`${side}_code`]
      if (!line || !/^(WP|AW)\d+P?F?$/i.test(code)) continue
      const name = row[`${side}_name`].replace(/\s*\([^)]*\)$/, '')
      const paint = find('Army Painter', line, name)
      if (!paint || !paint.sku?.startsWith('AP-')) continue
      const existing = codes.get(paint.id)
      if (existing && existing.code !== code.toUpperCase()) conflicts.push(`${paint.line}/${paint.name}: ${existing.code} vs ${code}`)
      else codes.set(paint.id, { paint, code: code.toUpperCase() })
    }
  }
  // A code must point at exactly one paint.
  const byCode = new Map<string, number>()
  for (const { code } of codes.values()) byCode.set(code, (byCode.get(code) ?? 0) + 1)
  const codeRows = [...codes.values()]
    .filter(({ code }) => byCode.get(code) === 1 && !catalog.some((p) => p.sku === code))
    .map(({ paint, code }) => ({ paint_id: paint.id, brand: paint.brand, line: paint.line, name: paint.name, old_sku: paint.sku, new_sku: code, source: 'mech9' }))

  // 2. Aliases: every spelling a chart import had to correct.
  const aliasRows: Array<Record<string, string>> = []
  const seenAlias = new Set<string>()
  const importFiles = [
    path.join(ROOT, 'army-painter', 'import', 'chart-rows.csv'),
    path.join(ROOT, 'mech9', 'import', 'chart-rows.csv'),
    path.join(ROOT, 'dakka', 'import', 'chart-rows.csv'),
  ]
  for (const file of importFiles) {
    const source = path.basename(path.dirname(path.dirname(file)))
    for (const row of readCsv(file)) {
      for (const match of (row.notes ?? '').matchAll(/(?:chart|mech9) prints "([^"]+)"/g)) {
        const printed = match[1]
        // A note corrects one side of the pairing: the side whose catalog name
        // is closest to the printed spelling (and close enough to be a typo).
        const parts = printed.split(/\s*\/\s*/).map((s) => s.replace(/\s*\([^)]*\)$/, '').trim())
        for (const alias of parts) {
          const n = normalizePaintName(alias)
          if (!n) continue
          const sides = (['target', 'source'] as const)
            .map((side) => find(row[`${side}_brand`], row[`${side}_line`], row[`${side}_name`]))
            .filter((p): p is Paint => Boolean(p))
            .map((paint) => ({ paint, similarity: similarity(n, normalizePaintName(paint.name)) }))
            .sort((a, b) => b.similarity - a.similarity)
          const best = sides[0]
          if (!best || best.similarity < 0.6 || n === normalizePaintName(best.paint.name)) continue
          const key = `${best.paint.id}|${n}`
          if (seenAlias.has(key)) continue
          seenAlias.add(key)
          aliasRows.push({ paint_id: best.paint.id, brand: best.paint.brand, line: best.paint.line, name: best.paint.name, alias, source })
        }
      }
    }
  }

  // 3. Hex second opinion: mech9 prints a colour for every paint it lists.
  const ranges: Record<string, { brand: string; lines: RegExp }> = {
    'Vallejo Game Color': { brand: 'Vallejo', lines: /^Game Color/ },
    'Vallejo Model Color': { brand: 'Vallejo', lines: /^Model Color/ },
    'Vallejo Model Air': { brand: 'Vallejo', lines: /^Model Air/ },
    'Vallejo Mecha Color': { brand: 'Vallejo', lines: /^Mecha/ },
    'AK 3rd Gen Acrylics': { brand: 'AK Interactive', lines: /./ },
    'Tamiya Lacquer Paint': { brand: 'Tamiya', lines: /^Lacquer/ },
  }
  const opinions = new Map<string, { paint: Paint; theirs: string }>()
  for (const row of mech9) {
    for (const side of ['source', 'target'] as const) {
      const range = ranges[row[`${side}_range`]]
      const code = row[`${side}_code`]
      const theirs = row[`${side}_hex`]
      if (!range || !code || !isUsableHex(theirs)) continue
      const paint = catalog.find((p) => p.brand === range.brand && range.lines.test(p.line) && p.sku === code)
      if (paint) opinions.set(paint.id, { paint, theirs: theirs.toUpperCase() })
    }
  }
  const hexRows = [...opinions.values()]
    .filter(({ paint }) => isUsableHex(paint.hex_approx))
    .map(({ paint, theirs }) => ({
      paint_id: paint.id,
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      ours: paint.hex_approx,
      ours_source: paint.hex_source,
      mech9: theirs,
      delta_e: deltaE2000(hexToLab(paint.hex_approx!), hexToLab(theirs)).toFixed(1),
    }))
    .sort((a, b) => Number(b.delta_e) - Number(a.delta_e))

  // 4. Current paints the charts reference that we lack (Dakka row hexes are approximate).
  const missing = [
    { brand: 'Warhammer Colour', line: 'Base', name: 'Ceramite White', sku: '', hex: '#FFFFFF', source: 'dakka (Citadel Base, current)' },
    ...[
      ['72.152', 'Heavy Orange', '#EE3823'],
      ['72.017', 'Sick Blue', '#412A7A'],
      ['72.018', 'Stormy Blue', '#27357E'],
      ['72.033', 'Livery Green', '#A9D171'],
      ['72.037', 'Filthy Brown', '#DE9408'],
      ['72.065', 'Terracotta', '#793721'],
      ['72.046', 'Ghost Grey', '#C3C6CD'],
    ].map(([sku, name, hex]) => ({ brand: 'Vallejo', line: 'Game Color', name, sku, hex, source: 'dakka (Vallejo Game Color)' })),
  ].filter((p) => !find(p.brand, p.line, p.name) && !(p.sku && catalog.some((c) => c.sku === p.sku)))

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'product-codes.csv'), csv(codeRows, ['paint_id', 'brand', 'line', 'name', 'old_sku', 'new_sku', 'source']))
  fs.writeFileSync(path.join(OUT, 'aliases.csv'), csv(aliasRows, ['paint_id', 'brand', 'line', 'name', 'alias', 'source']))
  fs.writeFileSync(path.join(OUT, 'hex-second-opinion.csv'), csv(hexRows, ['paint_id', 'brand', 'line', 'name', 'sku', 'ours', 'ours_source', 'mech9', 'delta_e']))
  fs.writeFileSync(path.join(OUT, 'missing-paints.csv'), csv(missing, ['brand', 'line', 'name', 'sku', 'hex', 'source']))

  const byLine: Record<string, number> = {}
  for (const r of codeRows) byLine[r.line] = (byLine[r.line] ?? 0) + 1
  console.log('official codes:', codeRows.length, byLine, '| conflicts:', conflicts.length, conflicts.slice(0, 5))
  console.log('aliases:', aliasRows.length, aliasRows.slice(0, 8).map((a) => `${a.alias} -> ${a.name}`).join(' | '))
  const far = hexRows.filter((r) => Number(r.delta_e) > 15)
  console.log('hex second opinions:', hexRows.length, '| disagree by ΔE00 > 15:', far.length)
  for (const r of far.slice(0, 10)) console.log(`  ${r.delta_e.padStart(5)} ${r.brand} ${r.line} ${r.name} ours ${r.ours} (${r.ours_source}) vs mech9 ${r.mech9}`)
  console.log('missing paints to add:', missing.length, missing.map((m) => m.name).join(', '))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
