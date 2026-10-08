/**
 * Turns the extracted Army Painter chart CSVs (scripts/extract-army-painter-charts.mjs)
 * into import-ready data, resolved against the live catalog:
 *
 *   data/conversion-charts/army-painter/import/new-paints.csv   paints to add to paint_catalog
 *   data/conversion-charts/army-painter/import/chart-rows.csv   one row per chart pairing
 *   data/conversion-charts/army-painter/import/unresolved.csv   targets left unmatched on purpose
 *
 * Read-only against the database.
 *
 *   npx tsx --env-file=.env.local scripts/build-army-painter-imports.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { normalizePaintName } from '../utils/paint-conversions/normalization'

const DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'army-painter')
const OUT = path.join(DIR, 'import')

type ChartRow = {
  section: string
  source_brand: string
  source_line: string
  source_name: string
  source_hex: string
  target_brand: string
  target_line: string
  target_name: string
  match: string
  notes: string
  swatch_x: string
  swatch_y: string
}

type CatalogPaint = { id: string; brand: string; line: string; name: string; hex_approx: string | null; paint_type: string | null }

const CHARTS: Array<{ file: string; source: string; url: string }> = [
  { file: 'fanatic-conversion.csv', source: 'Army Painter Warpaints Fanatic conversion chart (A3, v1.0)', url: 'https://www.thearmypainter.com' },
  { file: 'original-warpaints-conversion.csv', source: 'Army Painter Warpaints conversion chart (Citadel & Vallejo)', url: 'https://www.thearmypainter.com' },
  { file: 'historical-to-fanatic.csv', source: 'Army Painter Historical to Warpaints Fanatic colour comparison chart (2026)', url: 'https://www.thearmypainter.com' },
  { file: 'gamemaster-to-original-warpaints.csv', source: 'Army Painter GameMaster to Warpaints colour comparison chart (2023)', url: 'https://www.thearmypainter.com/gamemaster' },
  { file: 'gamemaster-to-fanatic.csv', source: 'Army Painter GameMaster to Warpaints Fanatic colour comparison chart (2024)', url: 'https://www.thearmypainter.com/gamemaster' },
  { file: 'licensed-to-fanatic.csv', source: 'Army Painter licensed colour comparison chart (2026)', url: 'https://www.thearmypainter.com' },
]

// Lines that exist only because these charts introduce them.
const NEW_LINE_SKU: Record<string, string> = {
  'Original Warpaints': 'WP',
  'Warpaints Air': 'AIR',
  Historical: 'HIST',
  GameMaster: 'GM',
  Infinity: 'INF',
  HeroScape: 'HS',
  BattleTech: 'BT',
  'Halo Flashpoint': 'HALO',
  Arcworld: 'ARC',
}

// Chart spellings -> catalog names. Every use is recorded in the row notes.
const CITADEL_FIXES: Record<string, string[]> = {
  'Macagge Blue': ['Macragge Blue'],
  'Steel Legion Brown': ['Steel Legion Drab'],
  'Dryard Bark': ['Dryad Bark'],
  'Hexos Palesun/ Dorn Yellow': ['Hexos Palesun', 'Dorn Yellow'],
  'Trollslayer Orange': ['Troll Slayer Orange'],
  'Warpfiend Grey/ Daemonette Hide': ['Warpfiend Grey', 'Daemonette Hide'],
  'White Scar / Ceramite': ['White Scar', 'Ceramite White'],
  'Administorum Grey': ['Administratum Grey'],
  'Emperors Children': ["Emperor's Children"],
  'Kislev/Ungor Flesh': ['Kislev Flesh', 'Ungor Flesh'],
  'Ushtabi Bone': ['Ushabti Bone'],
  'Kreig Khaki': ['Krieg Khaki'],
  'Lahmium Medium': ['Lahmian Medium'],
  'Warlock Bronze': ['Warplock Bronze'],
  'Runefang/Stormhost Silver': ['Runefang Steel', 'Stormhost Silver'],
  'Gehenna Gold': ["Gehenna's Gold"],
  'Agrax/ Reikland': ['Agrax Earthshade', 'Reikland Fleshshade'],
  'Beil-Tan Green': ['Biel-Tan Green'],
  'Seraphim/Agrax': ['Seraphim Sepia', 'Agrax Earthshade'],
  'Nightlords Blue': ['Night Lords Blue'],
  'Pink Horor': ['Pink Horror'],
}

// Vallejo names on the Warpaints chart are Game Color paints; the catalog
// splits Game Color into sub-lines and sometimes shortens names.
const VALLEJO_FIXES: Record<string, Array<[string, string]>> = {
  'Dead Flash': [['Game Color', 'Dead Flesh']],
  Bonewhite: [['Game Color', 'Bone White']],
  'Fluo Yellow/ Fluo Green': [['Game Color Fluo', 'Fluorescent Yellow'], ['Game Color Fluo', 'Fluorescent Green']],
  'Rust/ Dry Rust': [['Game Color Special FX', 'Rust']],
  'Chainmail Silver': [['Game Color Metallic', 'Chainmail']],
  'Red Wash': [['Game Color Wash', 'Red']],
  'Flesh Wash': [['Game Color Wash', 'Flesh']],
  'Sepia Wash': [['Game Color Wash', 'Sepia']],
  'Black Wash': [['Game Color Wash', 'Black']],
  'Umber Wash': [['Game Color Wash', 'Umber']],
  'Blue Wash': [['Game Color Wash', 'Blue']],
  'Sepia/Umber Wash': [['Game Color Wash', 'Sepia'], ['Game Color Wash', 'Umber']],
}
const VALLEJO_LINES = ['Game Color', 'Game Color Metallic', 'Game Color Special FX', 'Game Color Wash', 'Game Color Fluo', 'Game Color Ink']
const BRUSH_FIRST = (line: string) => (/\b(air|spray|dry)\b/i.test(line) ? 1 : 0)

function readCsv(file: string): ChartRow[] {
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
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ''])) as ChartRow
  })
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const cell = (value: unknown) => {
    const text = value === undefined || value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\n') + '\n'
}

function slug(name: string) {
  return name.toUpperCase().replace(/['’]/g, '').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// "Medium Drab" is a colour; only a trailing or "mixing" medium is a medium.
const UTILITY = /\b(primer|varnish|thinner)\b|\bmixing medium\b|\bmedium$/i
const METAL = /\b(metal|metallic|silver|gold|bronze|copper|brass|iron|steel|chrome|tin)\b/i
const WASH = /\b(tone|wash|shade|shader)\b/i
const EFFECT = /\b(rust|blood|mud|slime|snot|vomit|toner)\b/i

// "Steel Helmet Green" is a green, not a metal: a trailing colour word wins.
const ENDS_IN_COLOUR = /\b(green|grey|gray|blue|yellow|red|brown|khaki|purple|black|white)$/i

function guessType(name: string, line: string) {
  if (line === 'Warpaints Air') return 'airbrush acrylic'
  if (UTILITY.test(name)) return /primer/i.test(name) ? 'primer' : /varnish/i.test(name) ? 'varnish' : 'auxiliary'
  if (WASH.test(name)) return 'wash'
  if (METAL.test(name) && !ENDS_IN_COLOUR.test(name)) return 'metallic'
  if (EFFECT.test(name)) return 'effect'
  return 'acrylic'
}

// A specific signal in the name (wash, metallic, primer...) beats a generic
// inherited "acrylic"; "effect" is only trusted when the partner agrees,
// because "Orc Blood" and "Wyrm Blood" are ordinary paints.
function chooseType(name: string, line: string, inherited: string | undefined) {
  const guess = guessType(name, line)
  if (line === 'Warpaints Air') return 'airbrush acrylic'
  if (['primer', 'varnish', 'auxiliary', 'wash', 'metallic'].includes(guess)) return guess
  if (guess === 'effect') return !inherited || ['effect', 'technical'].includes(inherited) ? 'effect' : inherited
  return inherited && inherited !== 'airbrush acrylic' ? inherited : guess
}

// A browsable review page: every new paint with its sampled colour and chart partners.
function writeReview(
  paints: Array<Record<string, string>>,
  rows: Array<Record<string, string>>,
  unresolved: Array<Record<string, string>>
) {
  const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const partners = (p: Record<string, string>) => [
    ...new Set(
      rows
        .filter((r) => (r.source_line === p.line && r.source_name === p.name) || (r.target_line === p.line && r.target_name === p.name))
        .map((r) => (r.source_line === p.line && r.source_name === p.name ? `${r.target_line || r.target_brand} ${r.target_name}` : `${r.source_line} ${r.source_name}`))
    ),
  ]
  const card = (p: Record<string, string>) =>
    `<div class="card"><span class="chip" style="background:${esc(p.hex)}"></span><div><b>${esc(p.name)}</b><small>${esc(p.hex)} · ${esc(p.paint_type)}${p.hex_source === 'chart_partner' ? ' · <i>hex from partner</i>' : ''}</small><small class="p">${esc(partners(p).slice(0, 3).join(' · ') || 'no chart match')}</small></div></div>`
  const byChart: Record<string, number> = {}
  for (const r of rows) byChart[r.chart] = (byChart[r.chart] ?? 0) + 1
  const lines = [...new Set(paints.map((p) => p.line))]
  const html = `<!doctype html><meta charset="utf-8"><title>Army Painter import review</title>
<style>body{font:13px system-ui,sans-serif;margin:24px;background:#f6f4ef;color:#222;max-width:1400px}h2{margin-top:28px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px}.card{display:flex;gap:8px;background:#fff;border:1px solid #ddd;border-radius:6px;padding:6px}
.chip{flex:none;width:34px;height:34px;border-radius:4px;border:1px solid #999}.card small{display:block;color:#666}.card .p{color:#476}
table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px 8px;text-align:left}</style>
<h1>Army Painter import review</h1>
<p><b>${paints.length}</b> new catalog paints · <b>${rows.length}</b> chart pairings from ${Object.keys(byChart).length} official charts · <b>${unresolved.length}</b> targets left unresolved. Nothing has been written yet.</p>
<table>${Object.entries(byChart).map(([c, n]) => `<tr><td>${esc(c)}</td><td>${n} pairings</td></tr>`).join('')}</table>
${lines.map((l) => { const ps = paints.filter((p) => p.line === l); return `<h2>${esc(l)} (${ps.length})</h2><div class="grid">${ps.map(card).join('')}</div>` }).join('\n')}
<h2>Unresolved targets (${unresolved.length})</h2><p>Left unmatched on purpose: these names aren't in our catalog (incomplete Vallejo Game Color line, discontinued Citadel paints).</p>
<table><tr><th>Chart</th><th>Target</th><th>Why</th></tr>${unresolved.map((u) => `<tr><td>${esc(u.chart)}</td><td>${esc(u.brand)} ${esc(u.name)}</td><td>${esc(u.reason)}</td></tr>`).join('')}</table>`
  fs.mkdirSync(path.join(process.cwd(), 'scripts', 'output'), { recursive: true })
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'output', 'army-painter-import-review.html'), html)
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const catalog: CatalogPaint[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('id, brand, line, name, hex_approx, paint_type, sku')
      .eq('is_active', true)
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    catalog.push(...(data as CatalogPaint[]))
    if (data.length < 1000) break
  }
  const existingSkus = new Set((catalog as Array<CatalogPaint & { sku?: string }>).map((p) => p.sku).filter(Boolean))

  const key = (brand: string, line: string, name: string) => `${brand}|${line}|${normalizePaintName(name)}`
  const byLine = new Map(catalog.map((p) => [key(p.brand, p.line, p.name), p]))
  const find = (brand: string, line: string, name: string) => byLine.get(key(brand, line, name)) ?? null
  const findInBrand = (brand: string, name: string) =>
    catalog
      .filter((p) => p.brand === brand && normalizePaintName(p.name) === normalizePaintName(name))
      .sort((a, b) => BRUSH_FIRST(a.line) - BRUSH_FIRST(b.line))[0] ?? null

  // Our one existing Historical paint is the chart's "Flag Red" under a swapped name.
  const RENAMES = [{ brand: 'Army Painter', line: 'Historical', from: 'Red Flag', to: 'Flag Red' }]
  for (const rename of RENAMES) {
    const paint = find(rename.brand, rename.line, rename.from)
    if (paint) byLine.set(key(rename.brand, rename.line, rename.to), paint)
  }

  type NewPaint = { brand: string; line: string; name: string; hex: string; hex_source: string; paint_type: string; partner?: string; swatch_file?: string; swatch_x?: string; swatch_y?: string; charts: Set<string> }
  const newPaints = new Map<string, NewPaint>()
  const addNew = (paint: Omit<NewPaint, 'charts'>, chart: string) => {
    const k = key(paint.brand, paint.line, paint.name)
    const existing = newPaints.get(k)
    if (existing) {
      existing.charts.add(chart)
      // A paint's own swatch beats a partner's colour, and a later (newer)
      // chart's swatch beats an earlier one.
      if (paint.hex_source === 'chart_swatch') {
        Object.assign(existing, {
          hex: paint.hex,
          hex_source: paint.hex_source,
          swatch_file: paint.swatch_file,
          swatch_x: paint.swatch_x,
          swatch_y: paint.swatch_y,
        })
      }
      return
    }
    newPaints.set(k, { ...paint, charts: new Set([chart]) })
  }

  const chartRows: Array<Record<string, string>> = []
  const unresolved: Array<Record<string, string>> = []

  // Pass 1: sources. Every chart source paint either exists or is new.
  for (const chart of CHARTS) {
    for (const row of readCsv(chart.file)) {
      if (find(row.source_brand, row.source_line, row.source_name)) continue
      if (!NEW_LINE_SKU[row.source_line]) {
        unresolved.push({ chart: chart.file, side: 'source', brand: row.source_brand, line: row.source_line, name: row.source_name, reason: 'source paint not in catalog' })
        continue
      }
      addNew({ brand: row.source_brand, line: row.source_line, name: row.source_name, hex: row.source_hex, hex_source: 'chart_swatch', paint_type: '', swatch_file: chart.file, swatch_x: row.swatch_x, swatch_y: row.swatch_y }, chart.source)
    }
  }

  // Pass 2: targets.
  for (const chart of CHARTS) {
    for (const row of readCsv(chart.file)) {
      if (!row.target_name) continue

      const targets: Array<{ brand: string; line: string; name: string; note: string }> = []
      if (row.target_brand === 'Warhammer Colour') {
        const names = CITADEL_FIXES[row.target_name] ?? [row.target_name]
        for (const name of names) {
          const paint = findInBrand('Warhammer Colour', name)
          const note = names.length > 1 || name !== row.target_name ? `chart prints "${row.target_name}"` : ''
          if (paint) targets.push({ brand: paint.brand, line: paint.line, name: paint.name, note })
          else unresolved.push({ chart: chart.file, side: 'target', brand: 'Warhammer Colour', line: '', name, reason: `no Citadel paint named "${name}"${note ? ` (${note})` : ''}` })
        }
      } else if (row.target_brand === 'Vallejo') {
        const fixes = VALLEJO_FIXES[row.target_name]
        const candidates = fixes ?? VALLEJO_LINES.map((line) => [line, row.target_name] as [string, string])
        const hits = candidates.map(([line, name]) => find('Vallejo', line, name)).filter((p): p is CatalogPaint => p !== null)
        const chosen = fixes ? hits : hits.slice(0, 1)
        for (const paint of chosen) {
          targets.push({ brand: paint.brand, line: paint.line, name: paint.name, note: paint.name !== row.target_name ? `chart prints "${row.target_name}"` : '' })
        }
        if (chosen.length === 0) {
          unresolved.push({ chart: chart.file, side: 'target', brand: 'Vallejo', line: 'Game Color', name: row.target_name, reason: 'no unambiguous Vallejo Game Color paint by that name' })
        }
      } else {
        // Army Painter: the named line, Fanatic effects as a fallback, else a new paint.
        const paint =
          find('Army Painter', row.target_line, row.target_name) ??
          (row.target_line === 'Warpaints Fanatic' ? find('Army Painter', 'Warpaints Fanatic Effects', row.target_name) : null)
        if (paint) {
          targets.push({ brand: paint.brand, line: paint.line, name: paint.name, note: '' })
        } else if (NEW_LINE_SKU[row.target_line]) {
          const source = find(row.source_brand, row.source_line, row.source_name)
          const sourceNew = newPaints.get(key(row.source_brand, row.source_line, row.source_name))
          addNew(
            {
              brand: 'Army Painter',
              line: row.target_line,
              name: row.target_name,
              hex: source?.hex_approx ?? sourceNew?.hex ?? '',
              hex_source: 'chart_partner',
              paint_type: '',
              partner: `${row.source_line}/${row.source_name}`,
            },
            chart.source
          )
          targets.push({ brand: 'Army Painter', line: row.target_line, name: row.target_name, note: '' })
        } else {
          unresolved.push({ chart: chart.file, side: 'target', brand: 'Army Painter', line: row.target_line, name: row.target_name, reason: 'not in catalog' })
        }
      }

      for (const target of targets) {
        chartRows.push({
          chart: chart.source,
          chart_url: chart.url,
          section: row.section,
          source_brand: row.source_brand,
          source_line: row.source_line,
          source_name: RENAMES.find((r) => r.line === row.source_line && r.to === row.source_name) ? row.source_name : row.source_name,
          target_brand: target.brand,
          target_line: target.line,
          target_name: target.name,
          notes: [row.notes, target.note].filter(Boolean).join('; '),
        })
      }
    }
  }

  // Paint types: inherit from a chart partner already in the catalog.
  const partnerType = new Map<string, string>()
  for (const row of chartRows) {
    const target = find(row.target_brand, row.target_line, row.target_name)
    const sourceKey = key(row.source_brand, row.source_line, row.source_name)
    if (target?.paint_type && newPaints.has(sourceKey) && !partnerType.has(sourceKey)) partnerType.set(sourceKey, target.paint_type)
    const source = find(row.source_brand, row.source_line, row.source_name)
    const targetKey = key(row.target_brand, row.target_line, row.target_name)
    if (source?.paint_type && newPaints.has(targetKey) && !partnerType.has(targetKey)) partnerType.set(targetKey, source.paint_type)
  }

  const newRows = [...newPaints.entries()].map(([k, paint]) => {
    const inherited = partnerType.get(k)
    const paintType = chooseType(paint.name, paint.line, inherited)
    let sku = `AP-${NEW_LINE_SKU[paint.line]}-${slug(paint.name)}`
    while (existingSkus.has(sku)) sku += '-2'
    existingSkus.add(sku)
    return {
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku,
      hex: paint.hex,
      hex_source: paint.hex_source,
      paint_type: paintType,
      type_from: inherited ? 'chart partner' : 'name guess',
      partner: paint.partner ?? '',
      swatch_file: paint.swatch_file ?? '',
      swatch_x: paint.swatch_x ?? '',
      swatch_y: paint.swatch_y ?? '',
      charts: [...paint.charts].join(' | '),
    }
  })

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'new-paints.csv'), csv(newRows, ['brand', 'line', 'name', 'sku', 'hex', 'hex_source', 'paint_type', 'type_from', 'partner', 'swatch_file', 'swatch_x', 'swatch_y', 'charts']))
  fs.writeFileSync(path.join(OUT, 'chart-rows.csv'), csv(chartRows, ['chart', 'chart_url', 'section', 'source_brand', 'source_line', 'source_name', 'target_brand', 'target_line', 'target_name', 'notes']))
  fs.writeFileSync(path.join(OUT, 'unresolved.csv'), csv(unresolved, ['chart', 'side', 'brand', 'line', 'name', 'reason']))
  fs.writeFileSync(path.join(OUT, 'renames.json'), JSON.stringify(RENAMES, null, 2) + '\n')

  writeReview(newRows, chartRows, unresolved)

  const byLineCount: Record<string, number> = {}
  for (const row of newRows) byLineCount[row.line] = (byLineCount[row.line] ?? 0) + 1
  const byChart: Record<string, number> = {}
  for (const row of chartRows) byChart[row.chart] = (byChart[row.chart] ?? 0) + 1
  console.log('new paints:', newRows.length, byLineCount)
  console.log('hex sources:', newRows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.hex_source]: (acc[r.hex_source] ?? 0) + 1 }), {}))
  console.log('chart rows:', chartRows.length, byChart)
  console.log('unresolved:', unresolved.length)
  for (const u of unresolved) console.log(`  [${u.chart}] ${u.side} ${u.brand}/${u.line} "${u.name}": ${u.reason}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
