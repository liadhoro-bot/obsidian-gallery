/**
 * Phase 1 of docs/paint-equivalents-revival-2026-10-07.md: audit catalog hexes.
 *
 * Samples every catalog swatch image, compares it with the stored hex_approx,
 * cross-checks official conversion-chart partners and colour names, and writes
 *   scripts/output/paint-hex-audit.csv   (one row per active paint)
 *   scripts/output/paint-hex-audit.html  (contact sheet of everything not "keep")
 *
 * Dry run by default. `--apply` writes "fill" and "replace" rows (plus
 * "suggest" rows with --include-suggested, plus hand-picked hexes from
 * --overrides <csv with id,hex columns>). Writing needs the provenance columns
 * from supabase/migrations/20261007120000_add_paint_hex_provenance.sql.
 *
 *   npx tsx --env-file=.env.local scripts/audit-paint-hex.ts [--limit n] [--refresh]
 *     [--apply [--include-suggested] [--overrides file.csv] --yes]
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { deltaE2000, hexToLab, isUsableHex, type LabColor } from '../utils/paint-conversions/color'
import {
  classifyPaintFamily,
  familyLightnessWeight,
  isContextualFamily,
  type PaintFamily,
} from '../utils/paint-conversions/equivalents'

type CatalogRow = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  paint_type: string | null
  finish_type: string | null
  lab_l: number | null
  hex_previous?: string | null
}

type Sample = {
  hex: string
  mode: 'flat' | 'gradient' | 'radial'
  uniformity: number
}

// keep: stored hex is fine. fill: no usable hex, swatch sample is confident.
// replace: stored hex is clearly wrong (ΔE > REPLACE). suggest: swatch-backed
// moderate correction (ΔE 8-15), bulk-approvable. review: a human has to look.
type Action = 'keep' | 'fill' | 'replace' | 'suggest' | 'review'

type AuditRow = {
  paint: CatalogRow
  family: PaintFamily
  sample: Sample | null
  sampleError: string | null
  storedDelta: number | null
  proposedHex: string | null
  action: Action
  flags: string[]
  chartPartners: string[]
}

const OUTPUT_DIR = path.join(process.cwd(), 'scripts', 'output')
const CACHE_DIR = path.join(OUTPUT_DIR, 'swatch-cache')
const CSV_PATH = path.join(OUTPUT_DIR, 'paint-hex-audit.csv')
const HTML_PATH = path.join(OUTPUT_DIR, 'paint-hex-audit.html')
const PAGE_SIZE = 1000
const DOWNLOAD_CONCURRENCY = 4
const DOWNLOAD_ATTEMPTS = 4

// ΔE00 thresholds. Below SAME the swatch and stored hex are the same colour
// for our purposes; above it the stored hex is replaced by the sample.
const SAME_DELTA_E = 8
const REPLACE_DELTA_E = 15
const CHART_PAIR_DELTA_E = 15
const GRADIENT_DELTA_E = 12
const MIN_UNIFORMITY = 0.3

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const confirmed = args.includes('--yes')
const refresh = args.includes('--refresh')
const includeSuggested = args.includes('--include-suggested')
const overridesArg = args.indexOf('--overrides')
const overridesPath = overridesArg >= 0 ? args[overridesArg + 1] : null
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Number.POSITIVE_INFINITY

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function toHex(rgb: [number, number, number]) {
  return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function regionPixels(
  data: Buffer,
  size: number,
  [x0, x1]: [number, number],
  [y0, y1]: [number, number]
) {
  const pixels: Array<[number, number, number]> = []

  for (let y = Math.floor(y0 * size); y < Math.ceil(y1 * size); y += 1) {
    for (let x = Math.floor(x0 * size); x < Math.ceil(x1 * size); x += 1) {
      const offset = (y * size + x) * 4
      if (data[offset + 3] < 200) continue // transparent background
      pixels.push([data[offset], data[offset + 1], data[offset + 2]])
    }
  }

  return pixels
}

function medianColor(pixels: Array<[number, number, number]>): [number, number, number] | null {
  if (pixels.length === 0) return null

  return [0, 1, 2].map((channel) => median(pixels.map((pixel) => pixel[channel]))) as [
    number,
    number,
    number,
  ]
}

function uniformity(pixels: Array<[number, number, number]>, target: LabColor) {
  if (pixels.length === 0) return 0
  // Subsample: CIEDE2000 per pixel is the slow part of the audit.
  const step = Math.max(1, Math.floor(pixels.length / 400))
  let near = 0
  let checked = 0

  for (let index = 0; index < pixels.length; index += step) {
    checked += 1
    if (deltaE2000(hexToLab(toHex(pixels[index])), target) <= 5) near += 1
  }

  return near / checked
}

// Flat swatches: median of the centre. Gradient swatches (Citadel shades and
// contrasts fade from white at the top to full strength at the bottom, with a
// pot icon bottom-right): median of the bottom band, left of the icon.
export async function sampleSwatch(image: Buffer): Promise<Sample | null> {
  const size = 64
  const { data } = await sharp(image)
    .ensureAlpha()
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const top = medianColor(regionPixels(data, size, [0.05, 0.7], [0.02, 0.14]))
  const bottomPixels = regionPixels(data, size, [0.05, 0.7], [0.84, 0.97])
  const bottom = medianColor(bottomPixels)
  const centrePixels = regionPixels(data, size, [0.2, 0.8], [0.2, 0.8])
  const centre = medianColor(centrePixels)

  if (!centre) return null

  if (top && bottom) {
    const topLab = hexToLab(toHex(top))
    const bottomLab = hexToLab(toHex(bottom))

    if (deltaE2000(topLab, bottomLab) > GRADIENT_DELTA_E && bottomLab.l < topLab.l) {
      return { hex: toHex(bottom), mode: 'gradient', uniformity: uniformity(bottomPixels, bottomLab) }
    }
  }

  const centreLab = hexToLab(toHex(centre))
  const spot =medianColor(regionPixels(data, size, [0.4, 0.6], [0.4, 0.6]))
  const corners = medianColor([
    ...regionPixels(data, size, [0.02, 0.15], [0.02, 0.15]),
    ...regionPixels(data, size, [0.85, 0.98], [0.02, 0.15]),
    ...regionPixels(data, size, [0.02, 0.15], [0.85, 0.98]),
  ])

  // Spray and metallic renders put a bright highlight in the middle; neither
  // the highlight nor the dark rim is "the" colour, so a human decides.
  if (spot && corners) {
    const spotLab = hexToLab(toHex(spot))
    const cornerLab = hexToLab(toHex(corners))
    if (spotLab.l - cornerLab.l > 15 && deltaE2000(spotLab, cornerLab) > GRADIENT_DELTA_E) {
      return { hex: toHex(centre), mode: 'radial', uniformity: 0 }
    }
  }

  return { hex: toHex(centre), mode: 'flat', uniformity: uniformity(centrePixels, centreLab) }
}

async function loadImage(paint: CatalogRow) {
  const cachePath = path.join(CACHE_DIR, paint.id)

  if (!refresh && fs.existsSync(cachePath)) return fs.readFileSync(cachePath)

  // Storage answers bursts with spurious 400s, so retry before calling a URL broken.
  let response: Response | null = null
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    response = await fetch(paint.swatch_image_url!)
    if (response.ok) break
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  if (!response?.ok) throw new Error(`HTTP ${response?.status}`)

  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(cachePath, buffer)
  return buffer
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  let done = 0

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < items.length) {
        const index = next
        next += 1
        results[index] = await task(items[index])
        done += 1
        if (done % 250 === 0) console.log(`  sampled ${done}/${items.length}`)
      }
    })
  )

  return results
}

function isPlaceholderHex(paint: CatalogRow) {
  if (!isUsableHex(paint.hex_approx)) return true

  const hex = paint.hex_approx.toUpperCase()
  const name = (paint.name ?? '').toLowerCase()
  if (hex === '#FFFFFF' && !/white|snow|bone|skull|ivory|medium|varnish|thinner/.test(name)) return true
  if (hex === '#000000' && !/black|night|abyss/.test(name)) return true

  return false
}

// The head noun of a paint name is its last word ("Black Green" is a green,
// "Blue Black" is a black), so only the last word is checked.
const NAME_HUE_RULES: Array<[RegExp, (lab: LabColor) => boolean]> = [
  [/^black$/, (lab) => lab.l < 30],
  [/^white$/, (lab) => lab.l > 75],
  [/^(red|crimson|scarlet)$/, (lab) => hue(lab) < 60 || hue(lab) > 320],
  [/^(green|emerald)$/, (lab) => hue(lab) > 85 && hue(lab) < 215],
  [/^(blue|navy)$/, (lab) => hue(lab) > 180 && hue(lab) < 320],
  [/^yellow$/, (lab) => hue(lab) > 50 && hue(lab) < 115],
  [/^(purple|violet)$/, (lab) => hue(lab) > 260 || hue(lab) < 20],
]

function hue(lab: LabColor) {
  return (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360
}

function nameHueConflict(paint: CatalogRow, hex: string) {
  const words = (paint.name ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean)
  const head = words.at(-1)
  if (!head || /metal|gold|silver|wash|shade|tone|ink|fluor|chrome/.test(words.join(' '))) {
    return false
  }

  const lab = hexToLab(hex)
  // Very dark or desaturated colours have unstable hue; only check chromatic ones.
  const chroma = Math.hypot(lab.a, lab.b)

  return NAME_HUE_RULES.some(([pattern, ok]) => {
    if (!pattern.test(head)) return false
    if (head !== 'black' && head !== 'white' && chroma < 8) return false
    return !ok(lab)
  })
}

const CATALOG_FIELDS = 'id, brand, line, name, hex_approx, swatch_image_url, paint_type, finish_type, lab_l'

async function hasProvenanceColumns() {
  const { error } = await supabase.from('paint_catalog').select('hex_previous').limit(1)
  return !error
}

async function loadCatalog() {
  const rows: CatalogRow[] = []
  const fields = (await hasProvenanceColumns()) ? `${CATALOG_FIELDS}, hex_previous` : CATALOG_FIELDS

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select(fields)
      .eq('is_active', true)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    rows.push(...((data ?? []) as unknown as CatalogRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows.slice(0, limit)
}

async function loadChartPairs() {
  const { data, error } = await supabase
    .from('paint_conversion_edges')
    .select('source_paint_id, target_paint_id')
    .in('connection_type', ['official_conversion', 'official_equivalent'])
    .eq('is_active', true)

  if (error) throw error

  const partners = new Map<string, Set<string>>()
  for (const edge of data ?? []) {
    if (!partners.has(edge.source_paint_id)) partners.set(edge.source_paint_id, new Set())
    partners.get(edge.source_paint_id)!.add(edge.target_paint_id)
  }

  return partners
}

function auditPaint(paint: CatalogRow, sample: Sample | null, sampleError: string | null): AuditRow {
  const family = classifyPaintFamily(paint)
  const flags: string[] = []
  const placeholder = isPlaceholderHex(paint)
  const stored = placeholder ? null : paint.hex_approx!.toUpperCase()
  const confident = sample !== null && sample.uniformity >= MIN_UNIFORMITY
  const storedDelta =
    stored && sample
      ? deltaE2000(hexToLab(stored), hexToLab(sample.hex), familyLightnessWeight(family))
      : null

  if (!paint.hex_approx) flags.push('no_hex')
  else if (placeholder) flags.push('placeholder_hex')
  if (paint.hex_approx && paint.lab_l === null) flags.push('missing_lab')
  if (!paint.swatch_image_url) flags.push('no_swatch')
  if (sampleError) flags.push(/HTTP 4/.test(sampleError) ? 'swatch_broken_url' : 'swatch_unreadable')
  if (sample?.mode === 'radial') flags.push('swatch_radial_highlight')
  else if (sample && !confident) flags.push('swatch_noisy')

  let action: Action = 'keep'
  let proposedHex = stored

  if (!stored) {
    // A blank white swatch (clear products, missing artwork) is no better than
    // the placeholder it would replace.
    const blankSample = sample !== null && isPlaceholderHex({ ...paint, hex_approx: sample.hex })
    if (blankSample) flags.push('swatch_blank')

    if (confident && !blankSample) {
      action = 'fill'
      proposedHex = sample!.hex
    } else {
      action = 'review'
    }
  } else if (storedDelta !== null && storedDelta > SAME_DELTA_E) {
    flags.push('swatch_disagrees')
    // Mediums, varnishes and the like are usually rendered as a white or
    // clear pot, so the sample says nothing useful and a human decides.
    // Metallic renders carry highlights and reflections, so their samples
    // were wrong often enough in spot checks that a human decides those too.
    if (!confident || isContextualFamily(family) || family === 'metallic') {
      action = 'review'
    } else if (storedDelta > REPLACE_DELTA_E) {
      action = 'replace'
      proposedHex = sample!.hex
    } else {
      action = 'suggest'
      proposedHex = sample!.hex
    }
  }

  if (proposedHex && nameHueConflict(paint, proposedHex)) {
    flags.push('name_hue_conflict')
    if (action === 'keep') action = 'review'
  }

  return { paint, family, sample, sampleError, storedDelta, proposedHex, action, flags, chartPartners: [] }
}

function crossCheckCharts(rows: AuditRow[], partners: Map<string, Set<string>>) {
  const byId = new Map(rows.map((row) => [row.paint.id, row]))

  for (const row of rows) {
    for (const partnerId of partners.get(row.paint.id) ?? []) {
      const partner = byId.get(partnerId)
      if (!partner?.proposedHex || !row.proposedHex) continue

      const weight = Math.max(
        familyLightnessWeight(row.family),
        familyLightnessWeight(partner.family)
      )
      const distance = deltaE2000(hexToLab(row.proposedHex), hexToLab(partner.proposedHex), weight)
      if (distance <= CHART_PAIR_DELTA_E) continue

      row.chartPartners.push(
        `${partner.paint.brand} ${partner.paint.name} ${partner.proposedHex} (ΔE ${distance.toFixed(1)})`
      )
      if (!row.flags.includes('chart_pair_far')) row.flags.push('chart_pair_far')
      if (row.action === 'keep') row.action = 'review'
    }
  }
}

function flagSharedHexes(rows: AuditRow[]) {
  const groups = new Map<string, AuditRow[]>()

  for (const row of rows) {
    if (!row.proposedHex || isContextualFamily(row.family)) continue
    const key = `${row.paint.brand}|${row.paint.line}|${row.proposedHex}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  for (const group of groups.values()) {
    if (group.length < 3) continue
    for (const row of group) {
      row.flags.push('shared_hex_in_line')
      if (row.action === 'keep') row.action = 'review'
    }
  }
}

function csvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function writeCsv(rows: AuditRow[]) {
  const header = [
    'id', 'brand', 'line', 'name', 'family', 'action', 'flags', 'stored_hex', 'sampled_hex',
    'proposed_hex', 'delta_e_stored_vs_sample', 'swatch_mode', 'swatch_uniformity',
    'chart_partners_far', 'swatch_url',
  ]
  const lines = rows.map((row) =>
    [
      row.paint.id, row.paint.brand, row.paint.line, row.paint.name, row.family, row.action,
      row.flags.join(';'), row.paint.hex_approx, row.sample?.hex, row.proposedHex,
      row.storedDelta?.toFixed(1), row.sample?.mode, row.sample?.uniformity.toFixed(2),
      row.chartPartners.join(' | '), row.paint.swatch_image_url,
    ].map(csvValue).join(',')
  )

  fs.writeFileSync(CSV_PATH, [header.join(','), ...lines].join('\n'))
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!)
}

function chip(hex: string | null | undefined) {
  return hex
    ? `<span class="chip" style="background:${escapeHtml(hex)}"></span><code>${escapeHtml(hex)}</code>`
    : '<span class="chip none"></span><code>none</code>'
}

function writeHtml(rows: AuditRow[], summary: Record<string, number>) {
  const order: Record<Action, number> = { replace: 0, fill: 1, suggest: 2, review: 3, keep: 4 }
  const shown = rows
    .filter((row) => row.action !== 'keep')
    .sort((a, b) =>
      order[a.action] - order[b.action] ||
      `${a.paint.brand}${a.paint.line}${a.paint.name}`.localeCompare(`${b.paint.brand}${b.paint.line}${b.paint.name}`)
    )
  const body = shown
    .map(
      (row) => `<tr class="${row.action}">
  <td><b>${escapeHtml(row.paint.name)}</b><br><small>${escapeHtml(row.paint.brand)} · ${escapeHtml(row.paint.line)} · ${row.family}</small></td>
  <td>${row.paint.swatch_image_url ? `<img loading="lazy" src="${escapeHtml(row.paint.swatch_image_url)}">` : '—'}</td>
  <td>${chip(row.paint.hex_approx)}</td>
  <td>${chip(row.sample?.hex)}<br><small>${row.sample ? `${row.sample.mode}, uniform ${row.sample.uniformity.toFixed(2)}` : escapeHtml(row.sampleError) || 'no swatch'}</small></td>
  <td><span class="tag">${row.action}</span><br>${chip(row.proposedHex)}</td>
  <td><small>${row.flags.join('<br>')}${row.chartPartners.length ? `<br>${row.chartPartners.map(escapeHtml).join('<br>')}` : ''}</small></td>
</tr>`
    )
    .join('\n')

  fs.writeFileSync(
    HTML_PATH,
    `<!doctype html><meta charset="utf-8"><title>Paint hex audit</title>
<style>
body{font:13px system-ui,sans-serif;margin:24px;background:#f6f4ef;color:#222}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}
img{width:64px;height:64px;object-fit:cover;border:1px solid #ccc}
.chip{display:inline-block;width:28px;height:28px;border:1px solid #999;vertical-align:middle;margin-right:6px}
.chip.none{background:repeating-linear-gradient(45deg,#eee,#eee 4px,#ccc 4px,#ccc 8px)}
.tag{font-weight:700;text-transform:uppercase;font-size:11px}
tr.replace .tag{color:#b45309}tr.fill .tag{color:#047857}tr.suggest .tag{color:#0369a1}tr.review .tag{color:#7c3aed}
</style>
<h1>Paint hex audit</h1>
<p>Generated ${new Date().toISOString()} · ${Object.entries(summary).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
<table><tr><th>Paint</th><th>Swatch</th><th>Stored</th><th>Sampled</th><th>Proposal</th><th>Why</th></tr>
${body}
</table>`
  )
}

function loadOverrides() {
  if (!overridesPath) return new Map<string, string>()

  const [header, ...lines] = fs
    .readFileSync(overridesPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
  const columns = header.split(',').map((column) => column.trim())
  const idIndex = columns.indexOf('id')
  const hexIndex = columns.indexOf('hex')
  if (idIndex < 0 || hexIndex < 0) throw new Error('Overrides CSV needs "id" and "hex" columns.')

  const overrides = new Map<string, string>()
  for (const line of lines) {
    const cells = line.split(',').map((cell) => cell.trim())
    if (!cells[idIndex]) continue
    const hex = cells[hexIndex]?.toUpperCase()
    if (!isUsableHex(hex)) throw new Error(`Bad hex in overrides: ${line}`)
    overrides.set(cells[idIndex], hex)
  }

  return overrides
}

async function applyFixes(rows: AuditRow[]) {
  const overrides = loadOverrides()
  const unknownOverrides = [...overrides.keys()].filter(
    (id) => !rows.some((row) => row.paint.id === id)
  )
  if (unknownOverrides.length) {
    throw new Error(`Overrides for unknown paint ids: ${unknownOverrides.join(', ')}`)
  }

  const fixes = rows.flatMap((row) => {
    const override = overrides.get(row.paint.id)
    if (override) return [{ row, hex: override, source: 'manual' }]
    if (
      row.action === 'fill' ||
      row.action === 'replace' ||
      (includeSuggested && row.action === 'suggest')
    ) {
      return [{ row, hex: row.proposedHex!, source: 'swatch_sample' }]
    }
    return []
  })

  if (!confirmed) {
    console.log(`\n--apply would update ${fixes.length} paints. Re-run with --apply --yes to write.`)
    return
  }

  let written = 0
  for (const { row, hex, source } of fixes) {
    const lab = hexToLab(hex)
    const { error } = await supabase
      .from('paint_catalog')
      .update({
        hex_approx: hex,
        lab_l: lab.l,
        lab_a: lab.a,
        lab_b: lab.b,
        // Keep the very first legacy value if a paint is corrected twice.
        hex_previous: row.paint.hex_previous ?? row.paint.hex_approx,
        hex_source: source,
        hex_checked_at: new Date().toISOString(),
      })
      .eq('id', row.paint.id)

    if (error) throw error
    written += 1
  }

  console.log(`Updated ${written} paints. Previous values are kept in hex_previous.`)
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true })

  console.log('Loading catalog and chart pairs...')
  const [catalog, partners] = await Promise.all([loadCatalog(), loadChartPairs()])

  console.log(`Sampling ${catalog.filter((paint) => paint.swatch_image_url).length} swatches...`)
  const rows = await mapWithConcurrency(catalog, DOWNLOAD_CONCURRENCY, async (paint) => {
    if (!paint.swatch_image_url) return auditPaint(paint, null, null)

    try {
      return auditPaint(paint, await sampleSwatch(await loadImage(paint)), null)
    } catch (error) {
      return auditPaint(paint, null, (error as Error).message)
    }
  })

  crossCheckCharts(rows, partners)
  flagSharedHexes(rows)

  const summary: Record<string, number> = { paints: rows.length }
  for (const row of rows) {
    summary[row.action] = (summary[row.action] ?? 0) + 1
    for (const flag of row.flags) summary[flag] = (summary[flag] ?? 0) + 1
  }

  writeCsv(rows)
  writeHtml(rows, summary)
  console.table(summary)

  const byBrand: Record<string, Record<Action, number>> = {}
  for (const row of rows) {
    const brand = row.paint.brand ?? '?'
    byBrand[brand] ??= { keep: 0, fill: 0, replace: 0, suggest: 0, review: 0 }
    byBrand[brand][row.action] += 1
  }
  console.table(byBrand)
  console.log(`CSV:  ${CSV_PATH}\nHTML: ${HTML_PATH}`)

  if (apply) await applyFixes(rows)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
