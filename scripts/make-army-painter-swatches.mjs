/**
 * Builds 256x256 swatch images for the new Army Painter catalog paints by
 * cropping each paint's hexagon from the official chart PDF and painting out
 * the label text printed on it.
 *
 *   node scripts/make-army-painter-swatches.mjs <folder with the PDFs>
 *
 * Reads data/conversion-charts/army-painter/import/new-paints.csv and writes
 * scripts/output/army-painter-swatches/<sku>.png plus contact-sheet.png.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'

const SOURCE_DIR = process.argv[2]
const DATA = path.join(process.cwd(), 'data', 'conversion-charts', 'army-painter')
const OUT = path.join(process.cwd(), 'scripts', 'output', 'army-painter-swatches')
const SCALE = 6
const SIZE = 256

const PDFS = {
  'original-warpaints-conversion.csv': 'Warpaints_Colour_Conversion_Chart_web.pdf',
  'historical-to-fanatic.csv': 'Colour-Comparison-Chart-Historical-to-Fanatic-2026.pdf',
  'gamemaster-to-original-warpaints.csv': 'GameMaster_Colour_Comparison_Chart_web.pdf',
  'gamemaster-to-fanatic.csv': 'GameMaster_Warpaints_Fanatic_Colour_Comparison_Chart.pdf',
  'licensed-to-fanatic.csv': 'Licensed_Colour_Comparison_Chart_2026_web.pdf',
}

// Side (pt) of the square cropped from inside each chart's hexagons, kept
// clear of hexagon edges and frames.
const CROP = {
  'original-warpaints-conversion.csv': 18,
  'historical-to-fanatic.csv': 15,
  'gamemaster-to-original-warpaints.csv': 14,
  'gamemaster-to-fanatic.csv': 15,
  'licensed-to-fanatic.csv': 12,
}

function readCsv(file) {
  const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/)
  const columns = header.split(',')
  return lines.map((line) => {
    const cells = []
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

async function renderChart(file) {
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(path.join(SOURCE_DIR, file))), verbosity: 0 }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: SCALE })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise
  return ctx
}



function dominant(data, include = () => true) {
  const bins = new Map()
  for (let i = 0; i < data.length; i += 4) {
    if (!include(i)) continue
    const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n += 1
    bin.r += data[i]
    bin.g += data[i + 1]
    bin.b += data[i + 2]
    bins.set(key, bin)
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0]
  return top ? { r: top.r / top.n, g: top.g / top.n, b: top.b / top.n, n: top.n } : null
}

const distance = (data, i, c) => Math.hypot(data[i] - c.r, data[i + 1] - c.g, data[i + 2] - c.b)

// Paint out the label text printed on the hexagon. The fill is the most common
// colour; the text colour is the most common colour among pixels far from the
// fill (charts use white, black or dark text on any paint colour). Pixels closer
// to the text colour than to the fill are masked, which also catches the
// anti-aliased glyph edges, and are filled by diffusing the surrounding colour,
// keeping metallic sheen and texture outside the lettering.
//
// The fill is the paint's verified hex (sampled from the same hexagon), not
// the crop's most common colour: on small hexagons the lettering can cover
// more of the crop than the paint does. Flat paints mask everything that isn't
// paint-coloured (text, its shadow, hexagon borders, chart shading); textured paints (metallic,
// effect, wash) only mask the text colour so their sheen survives.
function removeText(data, width, height, fillHex, textured) {
  const fill = {
    r: parseInt(fillHex.slice(1, 3), 16),
    g: parseInt(fillHex.slice(3, 5), 16),
    b: parseInt(fillHex.slice(5, 7), 16),
  }
  const mask = new Uint8Array(width * height)

  if (textured) {
    const text = dominant(data, (i) => distance(data, i, fill) > 90)
    if (text && text.n > width * height * 0.02) {
      for (let p = 0; p < width * height; p += 1) {
        const i = p * 4
        const toFill = distance(data, i, fill)
        if (toFill > 30 && distance(data, i, text) < toFill) mask[p] = 1
      }
    }
  } else {
    for (let p = 0; p < width * height; p += 1) {
      if (distance(data, p * 4, fill) > 16) mask[p] = 1
    }
  }

  // Almost nothing paint-coloured left: the crop missed the swatch; use the hex.
  if (mask.reduce((sum, v) => sum + v, 0) > width * height * 0.9) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill.r
      data[i + 1] = fill.g
      data[i + 2] = fill.b
    }
    return 1
  }

  // Dilate by two pixels to catch the faintest glyph edges.
  for (let pass = 0; pass < 2; pass += 1) {
    const grown = mask.slice()
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = y * width + x
        if (!mask[p] && (mask[p - 1] || mask[p + 1] || mask[p - width] || mask[p + width])) grown[p] = 1
      }
    }
    mask.set(grown)
  }

  let remaining = mask.reduce((sum, v) => sum + v, 0)
  const coverage = remaining / (width * height)
  for (let guard = 0; remaining > 0 && guard < width; guard += 1) {
    const next = mask.slice()
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const p = y * width + x
        if (!mask[p]) continue
        let r = 0, g = 0, b = 0, n = 0
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (mask[q]) continue
          r += data[q * 4]
          g += data[q * 4 + 1]
          b += data[q * 4 + 2]
          n += 1
        }
        if (n === 0) continue
        data[p * 4] = r / n
        data[p * 4 + 1] = g / n
        data[p * 4 + 2] = b / n
        next[p] = 0
        remaining -= 1
      }
    }
    mask.set(next)
  }

  return coverage
}

async function main() {
  if (!SOURCE_DIR) throw new Error('Pass the folder that holds the Army Painter chart PDFs.')
  fs.mkdirSync(OUT, { recursive: true })
  const paints = readCsv(path.join(DATA, 'import', 'new-paints.csv')).filter((p) => p.swatch_file)
  const report = []

  for (const [csvFile, pdf] of Object.entries(PDFS)) {
    const group = paints.filter((p) => p.swatch_file === csvFile)
    if (group.length === 0) continue
    const ctx = await renderChart(pdf)
    const side = CROP[csvFile] * SCALE

    for (const paint of group) {
      const x = Math.round(Number(paint.swatch_x) * SCALE - side / 2)
      const y = Math.round(Number(paint.swatch_y) * SCALE - side / 2)
      const image = ctx.getImageData(x, y, side, side)
      const textured = ['metallic', 'effect', 'wash'].includes(paint.paint_type)
      const coverage = removeText(image.data, side, side, paint.hex, textured)
      const file = path.join(OUT, `${paint.sku}.png`)
      await sharp(Buffer.from(image.data.buffer), { raw: { width: side, height: side, channels: 4 } })
        .removeAlpha()
        .resize(SIZE, SIZE, { kernel: 'lanczos3' })
        .png()
        .toFile(file)
      report.push({ ...paint, file, coverage })
    }
    console.log(`${pdf}: ${group.length} swatches`)
  }

  // Contact sheet: swatch next to its catalog hex, flagging heavy text masks.
  const perRow = 10
  const tile = 120
  const sheet = createCanvas(perRow * tile, Math.ceil(report.length / perRow) * (tile + 30))
  const sc = sheet.getContext('2d')
  sc.fillStyle = '#fff'
  sc.fillRect(0, 0, sheet.width, sheet.height)
  for (const [i, paint] of report.entries()) {
    const left = (i % perRow) * tile
    const top = Math.floor(i / perRow) * (tile + 30)
    const thumb = await sharp(paint.file).resize(90, 90).png().toBuffer()
    const img = await import('@napi-rs/canvas').then(({ loadImage }) => loadImage(thumb))
    sc.drawImage(img, left + 4, top + 4)
    sc.fillStyle = paint.hex
    sc.fillRect(left + 96, top + 4, 18, 90)
    sc.fillStyle = paint.coverage > 0.35 ? '#c00' : '#000'
    sc.font = '10px sans-serif'
    sc.fillText(paint.name.slice(0, 19), left + 4, top + 108)
    sc.fillText(`${paint.line.slice(0, 11)} ${(paint.coverage * 100).toFixed(0)}%`, left + 4, top + 120)
  }
  fs.writeFileSync(path.join(OUT, 'contact-sheet.png'), sheet.toBuffer('image/png'))
  const heavy = report.filter((p) => p.coverage > 0.35)
  console.log(`wrote ${report.length} swatches; ${heavy.length} with >35% text mask:`, heavy.map((p) => p.name).join(', '))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
