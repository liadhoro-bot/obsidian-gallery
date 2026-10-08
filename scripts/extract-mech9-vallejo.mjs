/**
 * Downloads mech9.com's Vallejo paint conversion tables and writes them as
 * data/conversion-charts/mech9/vallejo-cross-reference.csv (one row per pairing).
 *
 * mech9 states its tables are "collated from data provided by paint
 * manufacturer's comparison charts"; we import them as a community source,
 * ranked below official manufacturer charts.
 *
 *   node scripts/extract-mech9-vallejo.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const PAGES = [
  'vallejo-game-color-paint-conversion',
  'vallejo-model-color-conversion-table',
  'vallejo-model-air-paint-conversion-table',
  'vallejo-mecha-color-paint-conversion',
  'vallejo-panzer-aces-conversion-table',
  'vallejo-metal-color-paint-conversion',
]
const OUT = path.join(process.cwd(), 'data', 'conversion-charts', 'mech9')

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')

// One swatch cell: name, (code), <span>range</span>, background colour.
function parseCell(html) {
  const hex = html.match(/background-color:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toUpperCase() ?? ''
  const anchor = html.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? html
  const range = decode(anchor.match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').trim()
  const lines = decode(anchor.replace(/<span[\s\S]*?<\/span>/, ''))
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const code = (lines.find((l) => /^\(.*\)$/.test(l)) ?? '').replace(/^\(|\)$/g, '')
  const name = lines.filter((l) => !/^\(.*\)$/.test(l)).join(' ').trim()
  return { name, code, range, hex }
}

function csv(rows, columns) {
  const cell = (v) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

async function main() {
  const rows = []
  for (const page of PAGES) {
    const url = `https://www.mech9.com/p/${page}.html`
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (paint-conversion research; obsidian-gallery)' } })
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    const html = await response.text()
    let count = 0

    for (const part of html.split('<div class="tbrow">').slice(1)) {
      const split = part.indexOf('<div class="tbtd"><div class="rightd">')
      if (split < 0) continue
      const source = parseCell(part.slice(0, split))
      // The source cell repeats its range in the name: "Bloody Red (Game Color)".
      source.name = source.name.replace(/\s*\((Game Color|Model Color|Model Air|Mecha Color|Panzer Aces|Metal Color)\)$/, '')
      const targets = part
        .slice(split)
        .split('<div class="cchcell ')
        .slice(1)
        .map((cell) => parseCell(cell.slice(0, cell.indexOf('</a>') + 4)))

      for (const target of targets) {
        rows.push({
          page: url,
          source_range: source.range,
          source_code: source.code,
          source_name: source.name,
          source_hex: source.hex,
          target_range: target.range,
          target_code: target.code,
          target_name: target.name,
          target_hex: target.hex,
        })
      }
      count += 1
    }
    console.log(`${page}: ${count} paints`)
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(
    path.join(OUT, 'vallejo-cross-reference.csv'),
    csv(rows, ['page', 'source_range', 'source_code', 'source_name', 'source_hex', 'target_range', 'target_code', 'target_name', 'target_hex'])
  )
  console.log(`${rows.length} pairings written`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
