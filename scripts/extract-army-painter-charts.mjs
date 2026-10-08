/**
 * Extracts The Army Painter's official colour comparison charts (PDF posters)
 * into CSVs under data/conversion-charts/army-painter/.
 *
 * Paint names are read from the PDF text layer by position (not by plain text
 * order, which collapses empty slots and shifts names into the wrong column),
 * and each paint's colour is sampled from its hexagon swatch on the chart.
 *
 *   node scripts/extract-army-painter-charts.mjs <folder with the PDFs>
 *
 * The Original Warpaints chart has no text layer; it is hand-transcribed in
 * original-warpaints-conversion.transcribed.tsv and only sampled here.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

const SOURCE_DIR = process.argv[2]
const OUT_DIR = path.join(process.cwd(), 'data', 'conversion-charts', 'army-painter')
const SHEET_DIR = path.join(process.cwd(), 'scripts', 'output', 'chart-extraction')
const SCALE = 4

const FILES = {
  fanatic: 'A3_Fanatic_Colour_Conversion_Chart_WEB (1).pdf',
  warpaints: 'Warpaints_Colour_Conversion_Chart_web.pdf',
  historical: 'Colour-Comparison-Chart-Historical-to-Fanatic-2026.pdf',
  gamemaster: 'GameMaster_Colour_Comparison_Chart_web.pdf',
  gamemasterFanatic: 'GameMaster_Warpaints_Fanatic_Colour_Comparison_Chart.pdf',
  licensed: 'Licensed_Colour_Comparison_Chart_2026_web.pdf',
}

async function loadChart(file) {
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(path.join(SOURCE_DIR, file))),
    verbosity: 0,
  }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const text = await page.getTextContent()
  const items = text.items
    .filter((item) => item.str.trim())
    .map((item) => ({
      s: item.str.trim(),
      x: item.transform[4],
      y: viewport.height - item.transform[5],
      w: item.width,
      h: item.height,
      font: item.fontName,
    }))
  const big = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(Math.ceil(big.width), Math.ceil(big.height))
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport: big }).promise
  return { items, canvas, ctx }
}

// Join the fragments of each hexagon label ("Light" / "Battle" / "Dress").
function labels(items, keep) {
  const seen = new Set()
  const frags = items
    .filter(keep)
    .filter((item) => {
      const key = `${item.s}|${Math.round(item.x)}|${Math.round(item.y)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
    // Decorative fonts draw a word's initial as its own run on the same
    // baseline ("T" + "rollhide"); glue touching runs back together.
    .reduce((merged, item) => {
      const last = merged.at(-1)
      if (last && Math.abs(last.y - item.y) < 0.5 && item.x - (last.x + last.w) < 1.5 && item.x > last.x) {
        merged[merged.length - 1] = { ...last, s: last.s + item.s, w: item.x + item.w - last.x }
      } else {
        merged.push(item)
      }
      return merged
    }, [])
    .map((item) => ({ ...item, cx: item.x + item.w / 2 }))
  const groups = []

  for (const frag of frags) {
    const group = groups.find(
      (g) => Math.abs(g.cx - frag.cx) < 14 && frag.y - g.ylast > 0 && frag.y - g.ylast < 10
    )
    if (group) {
      group.parts.push(frag)
      group.ylast = frag.y
    } else {
      groups.push({ parts: [frag], cx: frag.cx, ylast: frag.y })
    }
  }

  return groups.map((g) => ({
    name: tidy(g.parts.map((p) => p.s).join(' ')),
    x: g.cx,
    ytop: g.parts[0].y - g.parts[0].h,
    y: (g.parts[0].y - g.parts[0].h + g.ylast) / 2,
  }))
}

function tidy(name) {
  return name.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim()
}

const ACRONYMS = new Set(['UNSC'])

// Licensed charts print the licensed paints in capitals.
function titleCase(name) {
  if (name !== name.toUpperCase()) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
    .replace(/\b[A-Za-z]+\b/g, (word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word))
}

// Dominant fill colour of the hexagon around the label. Label text covers a
// minority of the swatch, so the most common colour bin is the fill; the
// result is the mean of the pixels in that bin.
function sampleHexagon(chart, label, radius = 10) {
  const size = Math.round(radius * 2 * SCALE)
  const data = chart.ctx.getImageData(
    Math.round((label.x - radius) * SCALE),
    Math.round((label.y - radius) * SCALE),
    size,
    size
  ).data
  const bins = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n += 1
    bin.r += data[i]
    bin.g += data[i + 1]
    bin.b += data[i + 2]
    bins.set(key, bin)
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0]
  return `#${[top.r, top.g, top.b].map((v) => Math.round(v / top.n).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function csv(rows, columns) {
  const cell = (value) => {
    const text = value === undefined || value === null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\n') + '\n'
}

const COLUMNS = [
  'section', 'source_brand', 'source_line', 'source_name', 'source_hex',
  'target_brand', 'target_line', 'target_name', 'match', 'notes', 'swatch_x', 'swatch_y',
]

// Contact sheet: chart crop around each source hexagon + sampled chip.
function writeSheet(chart, rows, file) {
  const perRow = 6
  const sheet = createCanvas(perRow * 240, Math.ceil(rows.length / perRow) * 56)
  const sc = sheet.getContext('2d')
  sc.fillStyle = '#fff'
  sc.fillRect(0, 0, sheet.width, sheet.height)
  rows.forEach((row, i) => {
    const left = (i % perRow) * 240
    const top = Math.floor(i / perRow) * 56
    sc.drawImage(chart.canvas, (row._x - 18) * SCALE, (row._y - 18) * SCALE, 36 * SCALE, 36 * SCALE, left, top, 52, 52)
    sc.fillStyle = row.source_hex
    sc.fillRect(left + 56, top + 6, 40, 40)
    sc.fillStyle = '#000'
    sc.font = '12px sans-serif'
    sc.fillText(row.source_name.slice(0, 20), left + 100, top + 22)
    sc.fillText(`${row.source_hex} → ${row.target_name || row.match}`.slice(0, 22), left + 100, top + 40)
  })
  fs.mkdirSync(SHEET_DIR, { recursive: true })
  fs.writeFileSync(path.join(SHEET_DIR, file), sheet.toBuffer('image/png'))
}

// "WORLD WAR II BRITISH 8 ARMY" -> "World War II British 8th Army" (the
// superscript TH is a separate glyph run).
function historicalSetName(title) {
  const nation = title
    .replace('WORLD WAR II', '')
    .trim()
    .toLowerCase()
    .replace(/\b8\b/, '8th')
    .replace(/(^|\s)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
  return `World War II ${nation}`
}

async function historical() {
  const chart = await loadChart(FILES.historical)
  // Hexagon names are small; section titles ("WORLD WAR II" / "GERMAN") are big.
  const isLabel = (item) =>
    item.h < 10 &&
    !/^(HISTORICAL|FANATIC|UNIQUE|COLOUR|WARPAINTS|fanatic|\*)/.test(item.s) &&
    !/^WP\d/.test(item.s) &&
    item.y > 280
  const all = labels(chart.items, isLabel)
  const titles = chart.items
    .filter((item) => item.s === 'WORLD WAR II')
    .map((head) => {
      const lines = chart.items
        .filter((item) => item.h >= 10 && item.s !== 'WORLD WAR II' && item.y > head.y && item.y - head.y < 45 && Math.abs(item.x + item.w / 2 - (head.x + head.w / 2)) < 45)
        .sort((a, b) => a.y - b.y)
      return { name: tidy(['WORLD WAR II', ...lines.map((l) => l.s)].join(' ')), x: head.x + head.w / 2, ytop: head.y }
    })
  const uniques = chart.items.filter((item) => item.s === 'UNIQUE')
  const notes = chart.items.filter((item) => item.s.startsWith('*'))
  const headers = chart.items.filter((item) => item.s === 'HISTORICAL' || item.s === 'FANATIC')
  const rows = []

  for (const label of all) {
    const header = headers
      .filter((h) => h.y < label.y && Math.abs(h.x + h.w / 2 - label.x) < 30)
      .sort((a, b) => b.y - a.y)[0]
    if (header?.s !== 'HISTORICAL') continue

    const section = titles
      .filter((t) => t.ytop < label.y && Math.abs(t.x - label.x) < 90)
      .sort((a, b) => b.ytop - a.ytop)[0]
    const partner = all.find((other) => other !== label && Math.abs(other.y - label.y) < 6 && other.x > label.x && other.x - label.x < 80)
    const unique = uniques.find((u) => Math.abs(u.y - label.y) < 8 && u.x > label.x && u.x - label.x < 90)
    const note = notes
      .filter((n) => n.s.startsWith('*Also') && Math.abs(n.x - label.x - 50) < 40 && n.y > label.y && n.y - label.y < 22)
      .map((n) => tidy(`${n.s} ${chart.items.find((m) => Math.abs(m.x - n.x) < 3 && m.y > n.y && m.y - n.y < 8)?.s ?? ''}`))[0]

    rows.push({
      section: historicalSetName(section?.name ?? ''),
      source_brand: 'Army Painter',
      source_line: 'Historical',
      source_name: label.name,
      source_hex: sampleHexagon(chart, label),
      target_brand: partner ? 'Army Painter' : '',
      target_line: partner ? 'Warpaints Fanatic' : '',
      target_name: partner?.name ?? '',
      match: partner ? 'match' : unique ? 'unique colour' : 'unknown',
      notes: note ? note.replace('*', '') : '',
      _x: label.x,
      swatch_x: label.x.toFixed(1),
      _y: label.y,
      swatch_y: label.y.toFixed(1),
    })
  }

  writeSheet(chart, rows, 'historical.png')
  return rows
}

async function gamemaster(file, sheetName, targetLine) {
  const chart = await loadChart(file)
  const all = labels(chart.items, (item) => item.h < 9 && item.y > 100 && item.y < 560).filter(
    (label) => /[a-z]/i.test(label.name)
  )
  const titles = chart.items.filter((item) => /PAINT SET|STARTER|MONSTERS|ADVENTURES/i.test(item.s) && item.h > 9)
  const rows = []

  for (const label of all) {
    const partner = all.find((other) => Math.abs(other.x - label.x) < 5 && other.y - label.y > 30 && other.y - label.y < 70)
    const isTop = !all.some((other) => Math.abs(other.x - label.x) < 5 && label.y - other.y > 30 && label.y - other.y < 70)
    if (!isTop) continue

    const section = titles.filter((t) => t.y < label.y).sort((a, b) => b.y - a.y)[0]
    const exclusive = /exclusive/i.test(partner?.name ?? '')
    rows.push({
      section: tidy(section?.s ?? '').replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase()),
      source_brand: 'Army Painter',
      source_line: 'GameMaster',
      source_name: label.name,
      source_hex: sampleHexagon(chart, label),
      target_brand: partner && !exclusive ? 'Army Painter' : '',
      target_line: partner && !exclusive ? targetLine : '',
      target_name: partner && !exclusive ? partner.name : '',
      match: !partner ? 'unknown' : exclusive ? 'gamemaster exclusive' : 'match',
      notes: '',
      _x: label.x,
      swatch_x: label.x.toFixed(1),
      _y: label.y,
      swatch_y: label.y.toFixed(1),
    })
  }

  writeSheet(chart, rows, sheetName)
  return rows
}

async function licensed() {
  const chart = await loadChart(FILES.licensed)
  const all = labels(chart.items, (item) => item.y > 170 && item.y < 1160 && !/^(WARPAINTS|fanatic)$/.test(item.s))
  const leftColumns = [39.1, 179.4, 319.7, 460, 600.3, 740.7]
  const rows = []

  function section(x, y) {
    if (x < 250) return 'Infinity'
    if (x < 530) return y < 800 ? 'HeroScape' : 'Halo Flashpoint'
    return y < 800 ? 'BattleTech' : 'Arcworld'
  }

  function partnerLine(x, y) {
    if (Math.abs(x - 740.7) < 10 && y < 800) return 'Speedpaint'
    if (Math.abs(x - 179.4) < 10 && y > 1000) return 'Speedpaint'
    return 'Warpaints Fanatic'
  }

  for (const label of all) {
    if (!leftColumns.some((x) => Math.abs(label.x - x) < 8)) continue
    const partner = all.find((other) => Math.abs(other.y - label.y) < 6 && other.x - label.x > 50 && other.x - label.x < 75)
    const exclusive = /exclusive/i.test(partner?.name ?? '')
    const line = partnerLine(label.x, label.y)

    rows.push({
      section: section(label.x, label.y),
      source_brand: 'Army Painter',
      source_line: section(label.x, label.y),
      source_name: titleCase(label.name),
      source_hex: sampleHexagon(chart, label),
      target_brand: partner && !exclusive ? 'Army Painter' : '',
      target_line: partner && !exclusive ? line : '',
      target_name: partner && !exclusive ? partner.name : '',
      match: !partner ? 'unknown' : exclusive ? 'exclusive colour' : 'match',
      notes: '',
      _x: label.x,
      swatch_x: label.x.toFixed(1),
      _y: label.y,
      swatch_y: label.y.toFixed(1),
    })
  }

  writeSheet(chart, rows, 'licensed.png')
  return rows
}

// Warpaints Fanatic conversion chart: each Fanatic paint (bold) is followed by
// fixed slots at +7.4 (Original Warpaints, "WP"), +14.6 (Warpaints Air, "AIR")
// and +21.8 (Citadel, "GW"). Empty slots have no text.
async function fanatic() {
  const chart = await loadChart(FILES.fanatic)
  const dedupe = (items) => {
    const seen = new Set()
    return items.filter((item) => {
      const key = `${item.s}|${Math.round(item.x)}|${Math.round(item.y)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  // Body text is small (the blurb, legend and title are larger).
  const body = chart.items.filter((item) => item.h < 7 && item.y > 60 && item.y < 820)
  const fontCounts = {}
  for (const item of body) fontCounts[item.font] = (fontCounts[item.font] ?? 0) + 1
  // The two body fonts: Fanatic names (bold, ~200) and conversions (~340).
  const [conversionFont, fanaticFont] = Object.entries(fontCounts).sort((a, b) => b[1] - a[1]).map(([font]) => font)
  const names = dedupe(body.filter((item) => item.font === fanaticFont))
  const conversions = dedupe(body.filter((item) => item.font === conversionFont))
  const slots = [
    ['Original Warpaints', 7.4],
    ['Warpaints Air', 14.6],
    ['Citadel', 21.8],
  ]
  const rows = []
  let placed = 0

  for (const name of names) {
    for (const [slot, dy] of slots) {
      const hit = conversions.filter((c) => Math.abs(c.x - name.x) < 4 && Math.abs(c.y - name.y - dy) < 1.6)
      if (hit.length > 1) throw new Error(`Ambiguous ${slot} slot for ${name.s}`)
      if (!hit[0]) continue
      placed += 1
      rows.push({
        section: '',
        source_brand: 'Army Painter',
        source_line: 'Warpaints Fanatic',
        source_name: tidy(name.s),
        source_hex: '',
        target_brand: slot === 'Citadel' ? 'Warhammer Colour' : 'Army Painter',
        target_line: slot === 'Citadel' ? '' : slot,
        target_name: tidy(hit[0].s),
        match: 'match',
        notes: '',
      })
    }
  }

  if (placed !== conversions.length) {
    throw new Error(`Placed ${placed} of ${conversions.length} conversion names; slot offsets need checking.`)
  }
  return rows
}

// Original Warpaints chart: names are vector outlines (no text layer), so they
// come from the hand transcription; only the hexagon colours are sampled.
async function originalWarpaints() {
  const chart = await loadChart(FILES.warpaints)
  const [header, ...lines] = fs
    .readFileSync(path.join(OUT_DIR, 'original-warpaints-conversion.transcribed.tsv'), 'utf8')
    .trim()
    .split(/\r?\n/)
  const columns = header.split('\t')
  const columnX = [83, 228, 373, 517, 661]
  const rows = []

  for (const line of lines) {
    const cell = Object.fromEntries(line.split('\t').map((value, i) => [columns[i], value]))
    const x = columnX[Number(cell.column)]
    const y = 144 + 40.3 * Number(cell.row)
    // Sample above the name text, inside the hexagon.
    const hex = sampleHexagon(chart, { x, y: y - 12.5 }, 2.5)
    const notes = cell.primer_100 === 'yes' ? '100% match to the Army Painter Colour Primer of the same name' : ''

    for (const [brand, printed] of [
      ['Warhammer Colour', cell.citadel_printed],
      ['Vallejo', cell.vallejo_printed],
    ]) {
      rows.push({
        section: '',
        source_brand: 'Army Painter',
        source_line: 'Original Warpaints',
        source_name: cell.warpaints,
        source_hex: hex,
        swatch_x: String(x),
        swatch_y: y.toFixed(1),
        target_brand: printed === 'N/A' ? '' : brand,
        target_line: '',
        target_name: printed === 'N/A' ? '' : printed,
        match: printed === 'N/A' ? `no ${brand === 'Vallejo' ? 'Vallejo' : 'Citadel'} match` : 'match',
        notes,
      })
    }
  }

  return rows
}

async function main() {
  if (!SOURCE_DIR) throw new Error('Pass the folder that holds the Army Painter chart PDFs.')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const outputs = {
    'fanatic-conversion.csv': await fanatic(),
    'original-warpaints-conversion.csv': await originalWarpaints(),
    'historical-to-fanatic.csv': await historical(),
    'gamemaster-to-original-warpaints.csv': await gamemaster(FILES.gamemaster, 'gamemaster.png', 'Original Warpaints'),
    'gamemaster-to-fanatic.csv': await gamemaster(FILES.gamemasterFanatic, 'gamemaster-fanatic.png', 'Warpaints Fanatic'),
    'licensed-to-fanatic.csv': await licensed(),
  }

  for (const [file, rows] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(OUT_DIR, file), csv(rows, COLUMNS))
    const kinds = {}
    for (const row of rows) kinds[row.match] = (kinds[row.match] ?? 0) + 1
    console.log(file.padEnd(40), rows.length, 'rows', kinds)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
