/**
 * Resolves the mech9 Vallejo cross-reference (scripts/extract-mech9-vallejo.mjs)
 * against the live catalog. Read-only.
 *
 *   data/conversion-charts/mech9/import/new-paints.csv   paints missing from lines we already carry
 *   data/conversion-charts/mech9/import/chart-rows.csv   pairings where both paints are (or will be) in the catalog
 *   data/conversion-charts/mech9/import/unresolved.csv   in-scope paints we don't carry in a line we don't carry
 *   scripts/output/mech9-import-review.html
 *
 *   npx tsx --env-file=.env.local scripts/build-mech9-imports.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { normalizePaintName } from '../utils/paint-conversions/normalization'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'mech9')
const OUT = path.join(DIR, 'import')

type Paint = { id: string; brand: string; line: string; name: string; sku: string | null; paint_type: string | null }
type Ref = { range: string; code: string; name: string; hex: string }

// mech9 range -> our brand, the lines to search, and (for paints we lack) the
// line a missing paint belongs to. Ranges without an entry are brands we don't
// carry and are skipped.
const RANGES: Record<string, { brand: string; lines?: RegExp; byCode: boolean; newLine?: (code: string) => string | null }> = {
  'Vallejo Game Color': { brand: 'Vallejo', lines: /^Game Color/, byCode: true, newLine: () => 'Game Color' },
  'Vallejo Model Color': { brand: 'Vallejo', lines: /^Model Color/, byCode: true, newLine: () => 'Model Color' },
  'Vallejo Model Air': { brand: 'Vallejo', lines: /^Model Air/, byCode: true, newLine: () => 'Model Air' },
  'Vallejo Game Air': { brand: 'Vallejo', lines: /^Game Air/, byCode: false, newLine: () => 'Game Air' },
  'Vallejo Mecha Color': { brand: 'Vallejo', lines: /^Mecha/, byCode: true, newLine: () => 'Mecha Color' },
  'Vallejo Hobby Paint Spray': { brand: 'Vallejo', lines: /^Hobby Paint/, byCode: true, newLine: () => 'Hobby Paint' },
  'Vallejo Wash FX': { brand: 'Vallejo', lines: /^Wash FX/, byCode: true, newLine: () => 'Wash FX' },
  'Vallejo Weathering FX': { brand: 'Vallejo', lines: /^Weathering FX/, byCode: true, newLine: () => 'Weathering FX' },
  'Vallejo Metal Color': { brand: 'Vallejo', lines: /^Metal Color/, byCode: true, newLine: () => 'Metal Color' },
  'Vallejo Panzer Aces': { brand: 'Vallejo', lines: /^Panzer Aces/, byCode: true, newLine: () => 'Panzer Aces' },
  // AK 3rd Gen paints live across our 3GEN, AFV, AIR and Figures lines.
  'AK 3rd Gen Acrylics': { brand: 'AK Interactive', byCode: true, newLine: () => '3GEN Acrylics' },
  // AK's pre-3rd-Gen acrylics (AK2xxx/AK3xxx/AK4xxx codes).
  'AK Acrylics': { brand: 'AK Interactive', byCode: true, newLine: () => 'Legacy Acrylics' },
  'Tamiya Lacquer Paint': { brand: 'Tamiya', lines: /^Lacquer/, byCode: true, newLine: () => 'Lacquer Paint' },
  'Citadel Colour': { brand: 'Warhammer Colour', byCode: false },
  Warpaints: { brand: 'Army Painter', lines: /^Original Warpaints$/, byCode: false },
  'Warpaints Fanatic': { brand: 'Army Painter', lines: /^Warpaints Fanatic/, byCode: false },
  'Warpaints Air': { brand: 'Army Painter', lines: /^Warpaints Air$/, byCode: false },
}

// "White Scar (Layer)", "Dark Tone (Wash)": the bracket is a range or type hint.
const CITADEL_LINE: Record<string, string> = { Layer: 'Layer', Edge: 'Layer', Base: 'Base', Shade: 'Shade', Dry: 'Dry', Technical: 'Technical', Contrast: 'Contrast', Glaze: 'Shade', Air: 'Air', Spray: 'Spray', Metal: 'Base' }
const FORMAT_VARIANT = /\b(air|spray|dry)\b/i
const normCode = (code: string | null) => (code ?? '').toUpperCase().replace(/[^A-Z0-9.]/g, '')

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

function csv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const cell = (v: unknown) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

// mech9 prints older AK rows in capitals.
function titleCase(name: string) {
  if (name !== name.toUpperCase()) return name
  return name.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase()).replace(/\b(Fs|Ral|Rlm|Ijn|Usaf|Usn|Bsc|Amt|Wwi|Wwii)\b/g, (w) => w.toUpperCase())
}

const METAL = /\b(metal|metallic|silver|gold|bronze|copper|brass|steel|chrome|gunmetal|aluminium|aluminum)\b/i
const WASH = /\b(wash|shade)\b/i
function guessType(name: string, line: string) {
  if (/air/i.test(line)) return METAL.test(name) ? 'metallic' : 'airbrush acrylic'
  if (/\b(varnish|primer|medium|thinner)\b/i.test(name)) return 'auxiliary'
  if (METAL.test(name) && !/\b(grey|gray|green|blue)$/i.test(name)) return 'metallic'
  if (WASH.test(name)) return 'wash'
  return 'acrylic'
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const catalog: Paint[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('id, brand, line, name, sku, paint_type').eq('is_active', true).order('id').range(from, from + 999)
    if (error) throw error
    catalog.push(...(data as Paint[]))
    if (data.length < 1000) break
  }
  const skus = new Set(catalog.map((p) => normCode(p.sku)).filter(Boolean))

  type Resolved = { paint?: Paint; newPaint?: { brand: string; line: string; name: string; code: string; hex: string }; status: string; note: string }
  const cache = new Map<string, Resolved>()

  function resolve(ref: Ref): Resolved {
    const cacheKey = `${ref.range}|${ref.code}|${ref.name}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)!
    const range = RANGES[ref.range]
    let result: Resolved
    if (!range) {
      result = { status: 'out_of_scope', note: '' }
    } else {
      let name = titleCase(ref.name)
      let lineHint: string | undefined
      const bracket = name.match(/^(.*?)\s*\(([^)]+)\)$/)
      const pool = catalog.filter((p) => p.brand === range.brand && (!range.lines || range.lines.test(p.line)))
      const byName = (n: string) =>
        pool
          .filter((p) => normalizePaintName(p.name) === normalizePaintName(n))
          .sort((a, b) => Number(lineHint ? a.line !== lineHint : false) - Number(lineHint ? b.line !== lineHint : false) || Number(FORMAT_VARIANT.test(a.line)) - Number(FORMAT_VARIANT.test(b.line)))[0]

      const byCode = range.byCode && ref.code ? pool.filter((p) => normCode(p.sku) === normCode(ref.code)) : []
      let paint = byCode.length === 1 ? byCode[0] : undefined
      let note = paint ? 'matched by product code' : ''
      if (!paint) paint = byName(name)
      // A product code is unique across the brand: Vallejo files surface
      // primers (70.6xx) in their own line, outside Model Color.
      if (!paint && range.byCode && ref.code) {
        const brandWide = catalog.filter((p) => p.brand === range.brand && normCode(p.sku) === normCode(ref.code))
        if (brandWide.length === 1) {
          paint = brandWide[0]
          note = 'matched by product code'
        }
      }
      if (!paint && bracket) {
        name = bracket[1]
        lineHint = CITADEL_LINE[bracket[2]]
        paint = byName(name)
        if (paint) note = `mech9 prints "${ref.name}"`
      }

      if (paint) result = { paint, status: note.startsWith('matched by product code') ? 'code' : 'name', note }
      else if (range.newLine && !(range.byCode && skus.has(normCode(ref.code)))) {
        const line = range.newLine(ref.code)!
        result = { newPaint: { brand: range.brand, line, name: titleCase(ref.name), code: ref.code, hex: ref.hex }, status: 'new', note: '' }
      } else result = { status: 'unresolved', note: range.newLine ? 'code already used by another catalog paint' : 'line not carried' }
    }
    cache.set(cacheKey, result)
    return result
  }

  const rows = readCsv(path.join(DIR, 'vallejo-cross-reference.csv'))
  const newPaints = new Map<string, NonNullable<Resolved['newPaint']> & { refs: number }>()
  const chartRows: Array<Record<string, string>> = []
  const unresolved = new Map<string, Record<string, string>>()
  const seenPairs = new Set<string>()
  const label = (r: Resolved) => (r.paint ? { brand: r.paint.brand, line: r.paint.line, name: r.paint.name } : r.newPaint!)

  for (const row of rows) {
    const source = resolve({ range: row.source_range, code: row.source_code, name: row.source_name, hex: row.source_hex })
    const target = resolve({ range: row.target_range, code: row.target_code, name: row.target_name, hex: row.target_hex })

    for (const [side, ref] of [
      [source, { range: row.source_range, code: row.source_code, name: row.source_name }],
      [target, { range: row.target_range, code: row.target_code, name: row.target_name }],
    ] as const) {
      if (side.newPaint) {
        const k = `${side.newPaint.brand}|${side.newPaint.line}|${normalizePaintName(side.newPaint.name)}`
        const existing = newPaints.get(k)
        if (existing) existing.refs += 1
        else newPaints.set(k, { ...side.newPaint, refs: 1 })
      }
      if (side.status === 'unresolved') unresolved.set(`${ref.range}|${ref.code}|${ref.name}`, { range: ref.range, code: ref.code, name: ref.name, reason: side.note })
    }

    if (!['code', 'name', 'new'].includes(source.status) || !['code', 'name', 'new'].includes(target.status)) continue
    const s = label(source)
    const t = label(target)
    const pairKey = [`${s.brand}|${s.line}|${s.name}`, `${t.brand}|${t.line}|${t.name}`].sort().join('~')
    if (s.brand === t.brand && s.line === t.line && s.name === t.name) continue
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)

    chartRows.push({
      source_brand: s.brand,
      source_line: s.line,
      source_name: s.name,
      source_code: row.source_code,
      target_brand: t.brand,
      target_line: t.line,
      target_name: t.name,
      target_code: row.target_code,
      notes: [source.note, target.note].filter(Boolean).join('; '),
      page: row.page,
    })
  }

  const newRows = [...newPaints.values()].map((p) => ({
    brand: p.brand,
    line: p.line,
    name: p.name,
    sku: p.code,
    hex: p.hex,
    hex_source: 'community_chart',
    paint_type: guessType(p.name, p.line),
    refs: p.refs,
  }))

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'new-paints.csv'), csv(newRows, ['brand', 'line', 'name', 'sku', 'hex', 'hex_source', 'paint_type', 'refs']))
  fs.writeFileSync(path.join(OUT, 'chart-rows.csv'), csv(chartRows, ['source_brand', 'source_line', 'source_name', 'source_code', 'target_brand', 'target_line', 'target_name', 'target_code', 'notes', 'page']))
  fs.writeFileSync(path.join(OUT, 'unresolved.csv'), csv([...unresolved.values()], ['range', 'code', 'name', 'reason']))
  writeReview(newRows, chartRows, [...unresolved.values()])

  const status: Record<string, Record<string, number>> = {}
  for (const [k, r] of cache) {
    const range = k.split('|')[0]
    if (r.status === 'out_of_scope') continue
    status[range] ??= {}
    status[range][r.status] = (status[range][r.status] ?? 0) + 1
  }
  console.log('distinct paints by range:')
  for (const [range, s] of Object.entries(status).sort()) console.log('  ' + range.padEnd(28), JSON.stringify(s))
  const byLine: Record<string, number> = {}
  for (const p of newRows) byLine[`${p.brand} ${p.line}`] = (byLine[`${p.brand} ${p.line}`] ?? 0) + 1
  console.log('new paints:', newRows.length, byLine)
  console.log('distinct pairings to import:', chartRows.length, '| unresolved paints:', unresolved.size)
}

function writeReview(paints: Array<Record<string, unknown>>, rows: Array<Record<string, string>>, unresolved: Array<Record<string, string>>) {
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const pairsByLine: Record<string, number> = {}
  for (const r of rows) {
    const k = [`${r.source_brand} ${r.source_line}`, `${r.target_brand} ${r.target_line}`].sort().join(' ↔ ')
    pairsByLine[k] = (pairsByLine[k] ?? 0) + 1
  }
  const lines = [...new Set(paints.map((p) => `${p.brand} ${p.line}`))]
  const html = `<!doctype html><meta charset="utf-8"><title>mech9 import review</title>
<style>body{font:13px system-ui,sans-serif;margin:24px;background:#f6f4ef;color:#222;max-width:1400px}h2{margin-top:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px}.card{display:flex;gap:8px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:6px}
.chip{flex:none;width:30px;height:30px;border-radius:4px;border:1px solid #999}.card small{display:block;color:#666}
table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:3px 8px;text-align:left}</style>
<h1>mech9 Vallejo cross-reference: import review</h1>
<p><b>${rows.length}</b> distinct pairings between paints we carry (or will add) · <b>${paints.length}</b> paints to add to lines we already carry · <b>${unresolved.length}</b> in-scope paints left out. Nothing written yet. Source: mech9.com, "collated from paint manufacturers' comparison charts"; imported as a community source ranked below official charts.</p>
<h2>Pairings by line</h2><table>${Object.entries(pairsByLine).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join('')}</table>
${lines.map((l) => `<h2>New: ${esc(l)} (${paints.filter((p) => `${p.brand} ${p.line}` === l).length})</h2><div class="grid">${paints.filter((p) => `${p.brand} ${p.line}` === l).map((p) => `<div class="card"><span class="chip" style="background:${esc(p.hex)}"></span><div><b>${esc(p.name)}</b><small>${esc(p.sku)} · ${esc(p.hex)} · ${esc(p.paint_type)}</small></div></div>`).join('')}</div>`).join('\n')}
<h2>Left out (${unresolved.length})</h2><table><tr><th>Range</th><th>Code</th><th>Name</th><th>Why</th></tr>${unresolved.map((u) => `<tr><td>${esc(u.range)}</td><td>${esc(u.code)}</td><td>${esc(u.name)}</td><td>${esc(u.reason)}</td></tr>`).join('')}</table>`
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'output', 'mech9-import-review.html'), html)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
