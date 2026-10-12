/**
 * Extracts AK Interactive's two official conversion charts by text position
 * (pdftotext collapses the empty cells, shifting columns):
 *
 *   EQUIVALENCIAS2023.pdf  AK 3rd Gen -> Vallejo Model Color (also Model Air /
 *                          Panzer Aces codes) / Vallejo Game Color / Citadel
 *   RCEquivalenceDIG.pdf   AK Real Color (old RC001-RC508 numbering) -> Mr.
 *                          Hobby / Tamiya / Vallejo / Hataka / Humbrol /
 *                          Model Master / Lifecolor
 *
 *   node scripts/extract-ak-charts.mjs <folder with the PDFs>
 *
 * Writes data/conversion-charts/ak-interactive/{3gen-equivalence,real-color-conversion}.csv.
 * The 3rd Gen chart prints no paint names, only a colour cell; its sampled
 * hex is kept as swatch_hex.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

const SOURCE_DIR = process.argv[2]
const OUT = path.join(process.cwd(), 'data', 'conversion-charts', 'ak-interactive')
const SCALE = 3

function csv(rows, columns) {
  const cell = (v) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

async function readPages(file, render = false) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(SOURCE_DIR, file))), verbosity: 0 }).promise
  const pages = []
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = content.items
      .filter((i) => i.str.trim())
      .map((i) => ({ s: i.str.trim(), x: i.transform[4], y: viewport.height - i.transform[5] }))
    let ctx = null
    if (render) {
      const vp = page.getViewport({ scale: SCALE })
      const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
      ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport: vp }).promise
    }
    pages.push({ n, items, ctx })
  }
  return pages
}

// Groups items into rows by baseline, then into columns by left edge.
function rowsOf(items, columns, minY) {
  const groups = []
  for (const item of items) {
    if (item.y < minY) continue
    let group = groups.find((g) => Math.abs(g.y - item.y) < 3)
    if (!group) groups.push((group = { y: item.y, items: [] }))
    group.items.push(item)
  }
  return groups
    .sort((a, b) => a.y - b.y)
    .map((group) => {
      const row = { y: group.y }
      for (const item of group.items.sort((a, b) => a.x - b.x)) {
        const column = columns.filter(([, x]) => item.x >= x).pop()[0]
        row[column] = row[column] ? `${row[column]} ${item.s}` : item.s
      }
      for (const key of Object.keys(row)) if (row[key] === '-') delete row[key]
      return row
    })
}

function sampleHex(ctx, x, y) {
  const data = ctx.getImageData(Math.round(x * SCALE), Math.round(y * SCALE), 30, 6).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n += 1
  }
  return '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

async function extractThirdGen() {
  const columns = [['ref', 0], ['vallejo_mc', 180], ['vallejo_gc', 280], ['citadel', 375], ['old_citadel', 480]]
  const rows = []
  for (const page of await readPages('EQUIVALENCIAS2023.pdf', true)) {
    for (const row of rowsOf(page.items, columns, 60)) {
      if (!/^AK\d+$/.test(row.ref ?? '')) continue
      rows.push({
        page: page.n,
        ref: row.ref,
        swatch_hex: sampleHex(page.ctx, 120, row.y - 3),
        // The Model Color column also carries full Model Air (71xxx) and
        // Panzer Aces (70.3xx) codes; three-digit codes are Model Color 70.xxx.
        vallejo: !row.vallejo_mc || !/^\d+$/.test(row.vallejo_mc)
          ? ''
          : row.vallejo_mc.length === 5
            ? `${row.vallejo_mc.slice(0, 2)}.${row.vallejo_mc.slice(2)}`
            : `70.${row.vallejo_mc}`,
        vallejo_gc: (row.vallejo_gc ?? '').split('/').filter(Boolean).map((c) => `72.${c}`).join(' / '),
        citadel: row.citadel ?? '',
        old_citadel: row.old_citadel && !/^(\S )+\S\*?$/.test(row.old_citadel) ? row.old_citadel : '',
        notes: row.vallejo_mc && !/^\d+$/.test(row.vallejo_mc) ? `Vallejo cell reads "${row.vallejo_mc}"` : '',
      })
    }
  }
  return rows
}

async function extractRealColor() {
  const columns = [
    ['ref', 0], ['name', 90], ['standard', 195], ['mr_hobby', 280], ['tamiya', 325],
    ['vallejo', 365], ['hataka', 405], ['humbrol', 445], ['model_master', 485], ['lifecolor', 530],
  ]
  const rows = []
  for (const page of await readPages('RCEquivalenceDIG.pdf')) {
    const pageRows = rowsOf(page.items, columns, 100)
    const refRows = pageRows.filter((r) => /^RC\d+$/.test(r.ref ?? ''))
    // Wrapped cells (long names, second standard) sit on their own baseline:
    // append them to the nearest row that has a reference.
    for (const extra of pageRows.filter((r) => !/^RC\d+$/.test(r.ref ?? ''))) {
      const nearest = refRows.reduce((best, r) => (Math.abs(r.y - extra.y) < Math.abs(best.y - extra.y) ? r : best), refRows[0])
      if (!nearest || Math.abs(nearest.y - extra.y) > 8) continue
      for (const [key, value] of Object.entries(extra)) if (key !== 'y') nearest[key] = nearest[key] ? `${nearest[key]} ${value}` : value
    }
    for (const row of refRows) {
      delete row.y
      rows.push({ page: page.n, ...row, hataka: row.hataka?.replace('HTK-_', 'HTK-') })
    }
  }
  return rows
}

async function main() {
  if (!SOURCE_DIR) throw new Error('Pass the folder that holds EQUIVALENCIAS2023.pdf and RCEquivalenceDIG.pdf.')
  fs.mkdirSync(OUT, { recursive: true })
  const thirdGen = await extractThirdGen()
  fs.writeFileSync(
    path.join(OUT, '3gen-equivalence.csv'),
    csv(thirdGen, ['page', 'ref', 'swatch_hex', 'vallejo', 'vallejo_gc', 'citadel', 'old_citadel', 'notes'])
  )
  console.log(`3rd Gen: ${thirdGen.length} refs, ${thirdGen.filter((r) => r.vallejo || r.vallejo_gc || r.citadel).length} with equivalents`)
  const realColor = await extractRealColor()
  fs.writeFileSync(
    path.join(OUT, 'real-color-conversion.csv'),
    csv(realColor, ['page', 'ref', 'name', 'standard', 'mr_hobby', 'tamiya', 'vallejo', 'hataka', 'humbrol', 'model_master', 'lifecolor'])
  )
  console.log(`Real Color: ${realColor.length} refs`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
