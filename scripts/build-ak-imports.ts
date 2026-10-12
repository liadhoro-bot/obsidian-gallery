/**
 * Builds the import files for AK Interactive's official charts and the two
 * ranges added alongside them (read-only against the database):
 *
 *   import/new-paints.csv        AK Real Colors (RC801-RC981) and Tamiya Color
 *                                Acrylic Paint from fetch-new-line-catalogs.mjs,
 *                                plus Vallejo paints the charts reference that
 *                                we lacked
 *   import/3gen-rows.csv         AK 3rd Gen -> Vallejo / Citadel pairings
 *   import/real-color-rows.csv   Real Color -> Vallejo / Tamiya pairings; the
 *                                chart's old RC001-RC508 codes are mapped to the
 *                                current RC8xx/RC9xx paints by name
 *   import/real-color-renumbering.csv, import/unresolved.csv for review
 *
 *   npx tsx --env-file=.env.local scripts/build-ak-imports.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createScriptClient } from './lib/script-supabase'
import { deltaE2000, hexToLab } from '../utils/paint-conversions/color'

const ROOT = process.cwd()
const AK = path.join(ROOT, 'data', 'conversion-charts', 'ak-interactive')
const OUT = path.join(AK, 'import')
const supabase = createScriptClient()

type Row = Record<string, string>
type Paint = { brand: string; line: string; sku: string | null; name: string; hex_approx: string | null; is_new?: boolean }

function readCsv(file: string): Row[] {
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
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? '']))
  })
}

function csv(rows: Array<Record<string, unknown>>, columns: string[]) {
  const cell = (v: unknown) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

// Paints the charts reference that the catalog lacked. Names and hexes from
// mech9's Vallejo tables (a community source).
const VALLEJO_ADDITIONS = [
  { line: 'Model Color', sku: '70.904', name: 'Dark Blue Grey', hex: '#547071' },
  { line: 'Model Air', sku: '71.401', name: 'UK BSC28 Silver Grey', hex: '#979876' },
  { line: 'Model Air', sku: '71.410', name: 'AII Zashchitnyi Camouflage Green', hex: '#2D3722' },
  { line: 'Model Air', sku: '71.411', name: 'A-19F Grass Green', hex: '#43622F' },
  { line: 'Model Air', sku: '71.413', name: 'A-18F Light Blue', hex: '#6EA998' },
  { line: 'Model Air', sku: '71.414', name: 'AEH-9 Light Grey', hex: '#7B8853' },
  { line: 'Model Air', sku: '71.415', name: 'A-21 Light Greyish Brown', hex: '#847F6D' },
]

// The chart's own misspellings of current Citadel names.
const CITADEL_SPELLING: Record<string, string> = {
  'Administratum grey': 'Administratum Grey',
  'Ushabit Bone': 'Ushabti Bone',
  'Altford Guard Blue': 'Altdorf Guard Blue',
  'Mourfang Brown': 'Mournfang Brown',
  'Waaagh¡ Flesh': 'Waaagh! Flesh',
  'Emperor’s Children': "Emperor's Children",
}

// Rows where the printed chart is evidently wrong.
const SKIP_3GEN: Record<string, string> = {
  AK11143: 'Citadel cells printed one row above their Vallejo cells (AK11144 has the Vallejo codes, no Citadel)',
  AK11144: 'Citadel cells printed one row above their Vallejo cells',
  AK11363: 'paired with 71.064 Chrome for a desert sand colour',
}

// Old Real Color code -> current code, decided by hand where names changed
// or name matching picked the wrong paint.
const RC_RENUMBER_OVERRIDES: Record<string, string | null> = {
  RC206: 'RC980', // "Torquise" typo
  RC073: 'RC876', // Protective 4BO -> Russian Green Protective 4BO
  RC238: null, // military Light Blue FS 35414, not the civil Light Blue
  RC240: null,
  RC310: null,
  RC311: null,
  RC255: null, // M-485 Light Grey was dropped; RC923 is M-485 Blue Grey
}

const RC_STOP = new Set(['no', 'bsc', 'bs381', 'bs381c', 'metallic', 'modern', 'ral', '840', 'hr', 'fs', 'version', 'ver', 'f9'])
const rcTokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[–-]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter((t) => t && !RC_STOP.has(t))
  )

function renumberRealColors(chart: Row[], current: Row[]) {
  const guesses = chart.map((r) => {
    const a = rcTokens(`${r.name} ${r.standard}`)
    const digits = (s: Set<string>) => [...s].filter((t) => /\d/.test(t))
    const scored = current
      .map((c) => {
        const b = rcTokens(c.name)
        const shared = [...a].filter((t) => b.has(t)).length
        return { c, score: shared / new Set([...a, ...b]).size, digitsOk: digits(b).every((t) => a.has(t)) }
      })
      .filter((s) => s.digitsOk)
      .sort((x, y) => y.score - x.score)
    const best = scored[0]
    const unique = best && (!scored[1] || scored[1].score < best.score)
    return { ref: r.ref, name: r.name, standard: r.standard, guess: best && unique && best.score >= 0.6 ? best.c.sku : null, score: best?.score ?? 0 }
  })
  // A current paint claimed by two old codes (e.g. RLM 78 1941 and 1942) is
  // ambiguous: drop both.
  const claims = new Map<string, number>()
  for (const g of guesses) if (g.guess) claims.set(g.guess, (claims.get(g.guess) ?? 0) + 1)
  return guesses.map((g) => {
    const override = Object.hasOwn(RC_RENUMBER_OVERRIDES, g.ref) ? RC_RENUMBER_OVERRIDES[g.ref] : undefined
    const current = override !== undefined ? override : g.guess && claims.get(g.guess) === 1 ? g.guess : null
    const why = override !== undefined ? 'manual' : g.guess && claims.get(g.guess)! > 1 ? 'ambiguous' : current ? `name match ${g.score.toFixed(2)}` : 'no current paint'
    return { ...g, current: current ?? '', why }
  })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const catalog: Paint[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('paint_catalog').select('brand, line, sku, name, hex_approx').range(from, from + 999)
    if (error) throw error
    catalog.push(...(data as Paint[]))
    if (data.length < 1000) break
  }

  // New paints.
  const realColors = readCsv(path.join(AK, 'real-colors-catalog.csv'))
  const tamiya = readCsv(path.join(ROOT, 'data', 'conversion-charts', 'tamiya', 'acrylic-catalog.csv'))
  const haveSku = new Set(catalog.map((p) => `${p.brand}|${p.sku}`))
  const newPaints = [
    ...realColors.map((p) => ({ ...p, hex_source: 'manufacturer', source: p.product_url })),
    ...tamiya.map((p) => ({ ...p, hex_source: p.hex ? 'manufacturer' : '', source: p.product_url })),
    ...VALLEJO_ADDITIONS.map((p) => ({
      brand: 'Vallejo',
      ...p,
      hex_source: 'community_chart',
      paint_type: p.line === 'Model Air' ? 'air' : 'acrylic',
      finish: 'matte',
      finish_type: 'standard',
      swatch_file: '',
      source: 'mech9 Vallejo tables; referenced by AK Interactive charts',
    })),
  ].filter((p) => !haveSku.has(`${p.brand}|${p.sku}`))
  fs.writeFileSync(
    path.join(OUT, 'new-paints.csv'),
    csv(newPaints, ['brand', 'line', 'sku', 'name', 'hex', 'hex_source', 'paint_type', 'finish', 'finish_type', 'swatch_file', 'source'])
  )

  const all: Paint[] = [...catalog, ...newPaints.map((p) => ({ brand: p.brand, line: p.line, sku: p.sku, name: p.name, hex_approx: p.hex || null, is_new: true }))]
  const bySku = new Map<string, Paint[]>()
  for (const p of all) if (p.sku) bySku.set(p.sku.toUpperCase(), [...(bySku.get(p.sku.toUpperCase()) ?? []), p])
  const citadel = all.filter((p) => p.brand === 'Warhammer Colour')
  const findCode = (code: string, brand: string) => (bySku.get(code.toUpperCase()) ?? []).filter((p) => p.brand === brand)
  const findCitadel = (name: string) =>
    citadel
      .filter((p) => p.name.toLowerCase() === name.toLowerCase())
      .sort((a, b) => Number(/air|spray|dry/i.test(a.line)) - Number(/air|spray|dry/i.test(b.line)))[0]
  const deltaE = (a: Paint, b: Paint) => (a.hex_approx && b.hex_approx ? deltaE2000(hexToLab(a.hex_approx), hexToLab(b.hex_approx)).toFixed(1) : '')

  const unresolved: Array<Record<string, string>> = []
  const pairRow = (chart: string, ref: string, source: Paint, target: Paint, column: string, code: string, notes = '') => ({
    source_brand: source.brand,
    source_line: source.line,
    source_code: source.sku ?? '',
    source_name: source.name,
    target_brand: target.brand,
    target_line: target.line,
    target_code: target.sku ?? '',
    target_name: target.name,
    delta_e: deltaE(source, target),
    notes: [`${chart} ${ref}`, `${column} ${code}`, notes].filter(Boolean).join('; '),
  })

  // AK 3rd Gen chart.
  const thirdGen = readCsv(path.join(AK, '3gen-equivalence.csv'))
  const thirdGenRows = []
  for (const r of thirdGen) {
    if (SKIP_3GEN[r.ref]) {
      unresolved.push({ chart: '3gen', ref: r.ref, column: '', value: '', reason: `skipped: ${SKIP_3GEN[r.ref]}` })
      continue
    }
    const targets: Array<[string, string]> = []
    if (r.vallejo) targets.push(['Vallejo', r.vallejo])
    for (const code of r.vallejo_gc.split(' / ').filter(Boolean)) targets.push(['Vallejo Game Color', code])
    if (r.citadel) targets.push(['Citadel', CITADEL_SPELLING[r.citadel] ?? r.citadel])
    if (targets.length === 0) continue

    const source = findCode(r.ref, 'AK Interactive').find((p) => p.line === '3GEN Acrylics') ?? findCode(r.ref, 'AK Interactive')[0]
    if (!source) {
      unresolved.push({ chart: '3gen', ref: r.ref, column: '', value: '', reason: 'AK paint not in catalog' })
      continue
    }
    for (const [column, value] of targets) {
      const target = column === 'Citadel' ? findCitadel(value) : findCode(value, 'Vallejo')[0]
      if (!target) unresolved.push({ chart: '3gen', ref: r.ref, column, value, reason: 'target not in catalog' })
      else thirdGenRows.push(pairRow('AK 3rd Gen chart', r.ref, source, target, column, value))
    }
    // Old (pre-2012) Citadel names are only kept as review notes.
    if (r.old_citadel) unresolved.push({ chart: '3gen', ref: r.ref, column: 'Old Citadel', value: r.old_citadel, reason: 'discontinued Citadel name (not imported)' })
  }

  // Real Color chart.
  const realChart = readCsv(path.join(AK, 'real-color-conversion.csv'))
  const renumbering = renumberRealColors(realChart, realColors)
  fs.writeFileSync(path.join(OUT, 'real-color-renumbering.csv'), csv(renumbering, ['ref', 'name', 'standard', 'current', 'why']))
  const currentByOld = new Map(renumbering.filter((r) => r.current).map((r) => [r.ref, r.current]))
  const realRows = []
  for (const r of realChart) {
    const targets: Array<[string, string, string]> = []
    for (const code of r.vallejo.split(/[\s/]+/).filter(Boolean)) targets.push(['Vallejo', code, 'Vallejo'])
    for (const code of r.tamiya.split(/[\s/]+/).filter(Boolean)) targets.push(['Tamiya', code, 'Tamiya'])
    if (targets.length === 0) continue
    const currentSku = currentByOld.get(r.ref)
    const source = currentSku ? findCode(currentSku, 'AK Interactive')[0] : undefined
    if (!source) {
      unresolved.push({ chart: 'real-color', ref: r.ref, column: '', value: r.name, reason: 'old Real Color code has no current paint' })
      continue
    }
    for (const [column, code, brand] of targets) {
      const target = findCode(code, brand).find((p) => brand !== 'Tamiya' || p.line === 'Acrylic Paint')
      if (!target) unresolved.push({ chart: 'real-color', ref: r.ref, column, value: code, reason: 'target not in catalog' })
      else realRows.push(pairRow('AK Real Color chart', r.ref, source, target, column, code, `current ${source.sku}`))
    }
  }

  // Opposite colours are misprints (Insignia White -> Tamiya X-1 Black), not
  // loose equivalents.
  for (const rows of [thirdGenRows, realRows]) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (Number(rows[i].delta_e) > 60) {
        unresolved.push({ chart: rows[i].notes.split(';')[0], ref: rows[i].source_code, column: rows[i].target_line, value: rows[i].target_code, reason: `skipped: colours far apart (ΔE ${rows[i].delta_e}), likely misprint` })
        rows.splice(i, 1)
      }
    }
  }

  const pairColumns = ['source_brand', 'source_line', 'source_code', 'source_name', 'target_brand', 'target_line', 'target_code', 'target_name', 'delta_e', 'notes']
  fs.writeFileSync(path.join(OUT, '3gen-rows.csv'), csv(thirdGenRows, pairColumns))
  fs.writeFileSync(path.join(OUT, 'real-color-rows.csv'), csv(realRows, pairColumns))
  fs.writeFileSync(path.join(OUT, 'unresolved.csv'), csv(unresolved, ['chart', 'ref', 'column', 'value', 'reason']))

  const count = (rows: Array<Record<string, string>>, key: string) =>
    rows.reduce<Record<string, number>>((acc, r) => ((acc[r[key]] = (acc[r[key]] ?? 0) + 1), acc), {})
  console.log(`new paints: ${newPaints.length}`, count(newPaints as Array<Record<string, string>>, 'line'))
  console.log(`3rd Gen pairings: ${thirdGenRows.length}`, count(thirdGenRows, 'target_line'))
  console.log(`Real Color: ${renumbering.filter((r) => r.current).length}/${renumbering.length} old codes mapped; pairings: ${realRows.length}`, count(realRows, 'target_line'))
  console.log('unresolved:', count(unresolved, 'reason'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
