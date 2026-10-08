/**
 * Resolves the DakkaDakka "Paint Range Compatibility Chart" (saved verbatim in
 * data/conversion-charts/dakka/paint-range-compatibility-chart.tsv) against the
 * live catalog. Read-only.
 *
 * Each table row is one equivalence group; every pair of cells in a row that
 * resolves to a paint we carry becomes a pairing. Cells the chart itself marks
 * as approximate ("2"), uncertain ("?") or a poor match ("(too dark/brown)")
 * are skipped.
 *
 *   npx tsx --env-file=.env.local scripts/build-dakka-imports.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { normalizePaintName } from '../utils/paint-conversions/normalization'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'dakka')
const OUT = path.join(DIR, 'import')

type Paint = { id: string; brand: string; line: string; name: string; sku: string | null }
type Cell = { column: string; raw: string; name: string; code: string }

// Columns for ranges we carry; the rest (Old Citadel, INSTAR, Rackham, Reaper,
// Coat d'Arms, Scale 75, Two Thin Coats) are skipped.
const COLUMNS: Record<string, { brand: string[]; lines?: RegExp; code?: (c: string) => string | null }> = {
  'New Citadel 5': { brand: ['Warhammer Colour'] },
  'Vallejo Game Color': {
    brand: ['Vallejo'],
    lines: /^Game Color/,
    // (001) -> 72.001, (73207) -> 73.207
    code: (c) => (/^\d{3}$/.test(c) ? `72.${c}` : /^\d{5}$/.test(c) ? `${c.slice(0, 2)}.${c.slice(2)}` : null),
  },
  'Vallejo Model Color': {
    brand: ['Vallejo'],
    lines: /^Model Color/,
    code: (c) => (/^\d{3}$/.test(c) ? `70.${c}` : /^70\.\d{3}$/.test(c) ? c : null),
  },
  'Privateer Press P3 4': { brand: ['P3 Formula', 'SFG (discontinued)'] },
  'Army Painter': { brand: ['Army Painter'], lines: /^Original Warpaints$/ },
}

const FORMAT_VARIANT = /\b(air|spray|dry)\b/i

function parseCells(column: string, raw: string): Cell[] {
  const text = raw.trim()
  if (!text || /\?$/.test(text) || /\(too dark|\(really far/i.test(text)) return []
  // A trailing footnote "2" marks an approximate match ("Dorn yellow 2", "Burnt Umber (941) 2").
  if (/(\s|\)|[a-z])2$/.test(text) || /\s2\s*\(/.test(text) || /\b2\(\d+\)$/.test(text)) return []

  const code = text.match(/\(([0-9.]+|WP\d+[^)]*)\)/)?.[1]?.trim() ?? ''
  const base = text
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+\d$/, '') // footnote digits
    .replace(/\|$/, '')
    .trim()
  // "Chaos Black / Black (051)", "Azure (902)/ Deep Sky Blue": alternatives for one paint.
  return base
    .split('/')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ column, raw: text, name, code: code.split(' ')[0] }))
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const catalog: Paint[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('id, brand, line, name, sku').eq('is_active', true).order('id').range(from, from + 999)
    if (error) throw error
    catalog.push(...(data as Paint[]))
    if (data.length < 1000) break
  }

  function resolve(cell: Cell): Array<{ paint: Paint; how: string }> {
    const spec = COLUMNS[cell.column]
    const pool = catalog.filter((p) => spec.brand.includes(p.brand) && (!spec.lines || spec.lines.test(p.line)))
    const code = spec.code?.(cell.code)
    if (code) {
      const hit = catalog.filter((p) => spec.brand.includes(p.brand) && p.sku === code)
      if (hit.length === 1) return [{ paint: hit[0], how: `code ${code}` }]
    }
    // Chart spellings and naming drift; each use is recorded in the notes.
    const FIXES: Record<string, string> = {
      'Demonic Yelow': 'Daemonic Yellow',
      'Kreig Khaki': 'Krieg Khaki',
      'Military Shade': 'Military Shader',
      'Ioson Green': 'Iosan Green',
      'Sulferic yellow': 'Sulfuric Yellow',
    }
    // Space-insensitive: "Great Coat Grey" is Greatcoat Grey, "Quicksilver" is Quick Silver.
    const key = (name: string) => normalizePaintName(name).replace(/\s+/g, '')
    const stripped = cell.name.replace(/\s+(Edge|Ink|Wash)$/i, '')
    const candidates = [cell.name, stripped, FIXES[cell.name] ?? '', FIXES[stripped] ?? ''].filter(Boolean)
    for (const name of candidates) {
      const hits = pool
        .filter((p) => key(p.name) === key(name))
        .sort((a, b) => Number(FORMAT_VARIANT.test(a.line)) - Number(FORMAT_VARIANT.test(b.line)))
      // One paint per brand: P3 cells link both the P3 Formula and the SFG versions.
      const perBrand = spec.brand.map((brand) => hits.find((p) => p.brand === brand)).filter((p): p is Paint => Boolean(p))
      if (perBrand.length) {
        return perBrand.map((paint) => ({ paint, how: name === cell.name ? 'name' : `chart prints "${cell.name}"` }))
      }
    }
    return []
  }

  const lines = fs.readFileSync(path.join(DIR, 'paint-range-compatibility-chart.tsv'), 'utf8').trim().split(/\r?\n/)
  const header = lines[0].split('\t')
  const pairs = new Map<string, Record<string, string>>()
  const unresolved = new Map<string, Record<string, string>>()
  let skippedApprox = 0

  for (const [index, line] of lines.slice(1).entries()) {
    const cells = line.split('\t')
    const resolved: Array<{ paint: Paint; cell: Cell; how: string }> = []

    for (const [i, raw] of cells.entries()) {
      const column = header[i]
      if (!COLUMNS[column] || !raw.trim()) continue
      const parsed = parseCells(column, raw)
      if (parsed.length === 0) {
        skippedApprox += 1
        continue
      }
      // Alternatives in one cell: use the first that resolves.
      const hit = parsed.map((cell) => ({ cell, matches: resolve(cell) })).find((x) => x.matches.length)
      if (hit) for (const m of hit.matches) resolved.push({ paint: m.paint, cell: hit.cell, how: m.how })
      else unresolved.set(`${column}|${raw}`, { column, cell: raw.trim(), row: String(index + 1) })
    }

    for (let a = 0; a < resolved.length; a += 1) {
      for (let b = a + 1; b < resolved.length; b += 1) {
        const [s, t] = [resolved[a], resolved[b]]
        if (s.paint.id === t.paint.id) continue
        const key = [s.paint.id, t.paint.id].sort().join('|')
        if (pairs.has(key)) continue
        pairs.set(key, {
          source_brand: s.paint.brand,
          source_line: s.paint.line,
          source_name: s.paint.name,
          target_brand: t.paint.brand,
          target_line: t.paint.line,
          target_name: t.paint.name,
          notes: [`row ${index + 1}`, s.how !== 'name' ? s.how : '', t.how !== 'name' ? t.how : ''].filter(Boolean).join('; '),
        })
      }
    }
  }

  const csv = (rows: Array<Record<string, string>>, columns: string[]) =>
    [columns.join(','), ...rows.map((r) => columns.map((c) => (/[",\n]/.test(r[c] ?? '') ? `"${(r[c] ?? '').replaceAll('"', '""')}"` : r[c] ?? '')).join(','))].join('\n') + '\n'
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'chart-rows.csv'), csv([...pairs.values()], ['source_brand', 'source_line', 'source_name', 'target_brand', 'target_line', 'target_name', 'notes']))
  fs.writeFileSync(path.join(OUT, 'unresolved.csv'), csv([...unresolved.values()], ['column', 'cell', 'row']))

  const byLines: Record<string, number> = {}
  for (const p of pairs.values()) {
    const k = [`${p.source_brand} ${p.source_line}`, `${p.target_brand} ${p.target_line}`].sort().join(' <-> ')
    byLines[k] = (byLines[k] ?? 0) + 1
  }
  console.log('pairings:', pairs.size, '| cells skipped as approximate/uncertain:', skippedApprox, '| unresolved cells:', unresolved.size)
  console.log(Object.entries(byLines).sort((a, b) => b[1] - a[1]).slice(0, 12))
  const byColumn: Record<string, string[]> = {}
  for (const u of unresolved.values()) (byColumn[u.column] ??= []).push(u.cell)
  for (const [c, v] of Object.entries(byColumn)) console.log(`unresolved ${c} (${v.length}):`, v.slice(0, 18).join(' | '))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
