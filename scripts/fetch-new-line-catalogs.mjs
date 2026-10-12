/**
 * Fetches two ranges we didn't carry and builds their catalog rows from the
 * manufacturers' own product data:
 *
 *   AK Interactive Real Colors  ak-interactive.com store API, category
 *                               real-colors-en (single paints RC801-RC981)
 *   Tamiya Color Acrylic Paint  tamiya.com product lists (23 ml range plus the
 *                               10 ml "Mini"-only colours)
 *
 * Each product image is sampled for a hex and cropped into a 256px swatch:
 * Real Colors photos show a brush stroke of the paint, Tamiya's show the
 * official colour hexagon.
 *
 *   node scripts/fetch-new-line-catalogs.mjs
 *
 * Writes data/conversion-charts/ak-interactive/real-colors-catalog.csv,
 * data/conversion-charts/tamiya/acrylic-catalog.csv, swatches under
 * scripts/output/new-line-swatches/ and a contact sheet there.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const ROOT = process.cwd()
const CACHE = path.join(ROOT, 'scripts', 'output', 'new-line-images')
const SWATCHES = path.join(ROOT, 'scripts', 'output', 'new-line-swatches')
const UA = { 'User-Agent': 'Mozilla/5.0 (paint catalog research; obsidian-gallery)' }

function csv(rows, columns) {
  const cell = (v) => {
    const text = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}

async function cached(url, file) {
  const target = path.join(CACHE, file)
  if (!fs.existsSync(target)) {
    const response = await fetch(url, { headers: UA })
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  }
  return target
}

// Most common colour (4-bit bins) inside the box, averaged within its bin.
function dominantHex(data) {
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
  return '#' + [top.r, top.g, top.b].map((v) => Math.round(v / top.n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

// box is in fractions of the image: [left, top, size].
async function swatchFrom(file, box, out) {
  const image = await loadImage(fs.readFileSync(file))
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const side = Math.round(box[2] * image.width)
  const left = Math.round(box[0] * image.width)
  const top = Math.round(box[1] * image.height)
  const { data } = ctx.getImageData(left, top, side, side)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await sharp(Buffer.from(data.buffer), { raw: { width: side, height: side, channels: 4 } })
    .removeAlpha()
    .resize(256, 256, { kernel: 'lanczos3' })
    .png()
    .toFile(out)
  return dominantHex(data)
}

const titleCase = (s) =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\((ijn|raf|jgsdf|dak)\b/gi, (m) => m.toUpperCase())
    .replace(/\b(Ijn|Raf|Ijn|Rlm|Nato|Usaf|Fs|Ral|Bs|Ja|Jn)\b/g, (m) => m.toUpperCase())

async function realColors() {
  const products = []
  for (let page = 1; ; page += 1) {
    const url = `https://ak-interactive.com/wp-json/wc/store/v1/products?category=101810&per_page=100&page=${page}`
    const response = await fetch(url, { headers: UA })
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    const batch = await response.json()
    products.push(...batch)
    if (batch.length < 100) break
  }
  const singles = products.filter((p) => /^RC\d{3}$/.test(p.sku)).sort((a, b) => a.sku.localeCompare(b.sku))
  const rows = []
  for (const p of singles) {
    const name = p.name.replace(/&#8211;|–/g, '-').replace(/\s+/g, ' ').trim()
    const categories = p.categories.map((c) => c.slug)
    const n = Number(p.sku.slice(2))
    const lower = name.toLowerCase()
    const paintType = /varnish/.test(lower) ? 'varnish' : 'lacquer'
    const metallic = /\b(gun metal|aluminium|gold|pearl)\b/.test(lower)
    const clear = /^clear\b/.test(lower)
    const civil = categories.some((c) => /civil/.test(c)) || (n >= 827 && n <= 850)
    const image = p.images[0]?.src
    let hex = ''
    let swatch = ''
    if (image) {
      const file = await cached(image, `real-colors/${p.sku}.jpg`)
      swatch = path.join(SWATCHES, 'real-colors', `${p.sku.toLowerCase()}.png`)
      // The brush stroke right of the bottle.
      hex = await swatchFrom(file, [0.68, 0.48, 0.2], swatch)
    }
    rows.push({
      brand: 'AK Interactive',
      line: 'Real Colors',
      sku: p.sku,
      name,
      hex,
      paint_type: paintType,
      finish: paintType === 'varnish' ? 'varnish' : metallic ? 'metallic' : clear ? 'transparent' : civil ? 'gloss' : 'matte',
      finish_type: metallic ? 'metallic' : paintType === 'varnish' ? 'varnish' : 'standard',
      product_url: p.permalink,
      image_url: image ?? '',
      swatch_file: swatch ? path.relative(ROOT, swatch).replaceAll('\\', '/') : '',
    })
  }
  return rows
}

async function tamiyaList(genre) {
  const items = new Map()
  for (let page = 1; page <= 20; page += 1) {
    const url = `https://www.tamiya.com/english/products/list.html?field_sort=d&cmdarticlesearch=1&genre_item=${genre}&absolutepage=${page}`
    const response = await fetch(url, { headers: UA })
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    const html = await response.text()
    const before = items.size
    for (const m of html.matchAll(
      /<a href="([^"]+)" data-article="(\d+)">\s*<div class="img_"><img class="[^"]*" src="([^"\n\r]+)\s*"><\/div>[\s\S]*?<h3><span>ITEM (\d+)\s*<\/span>([^<]+)<\/h3>/g
    )) {
      items.set(m[4], { item: m[4], title: m[5].trim(), url: m[1], thumb: `https:${m[3].trim()}` })
    }
    if (items.size === before) break
  }
  return [...items.values()]
}

const TAMIYA_METALLIC = new Set(['X-10', 'X-11', 'X-12', 'X-13', 'X-31', 'X-32', 'X-33', 'X-34', 'XF-6', 'XF-16', 'XF-28', 'XF-56', 'XF-84'])
const TAMIYA_CLEAR = /^X-(19|2[3-7])$/
const TAMIYA_UTILITY = { 'X-20A': 'auxiliary', 'X-21': 'auxiliary', 'X-22': 'varnish', 'X-35': 'varnish', 'XF-86': 'varnish' }

async function tamiyaAcrylics() {
  const full = await tamiyaList('e_504009')
  const mini = await tamiyaList('e_504010')
  const code = (title) => title.match(/\b(XF|X)-\d+A?\b/)?.[0]
  const byCode = new Map()
  for (const item of full) if (/^ACRYLIC PAINT (XF|X)-/.test(item.title)) byCode.set(code(item.title), { ...item, size: '23ml' })
  for (const item of mini) if (/^ACRYLIC (PAINT )?MINI (XF|X)-/.test(item.title) && !byCode.has(code(item.title))) byCode.set(code(item.title), { ...item, size: '10ml' })

  const rows = []
  for (const [sku, item] of [...byCode].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    const name = titleCase(item.title.replace(/^ACRYLIC (PAINT )?(MINI )?(XF|X)-\d+A?\s*/, '').replace(/\s*\(\d+ml\)$/i, ''))
      .replace(/\bGrrey\b/, 'Grey')
    const utility = TAMIYA_UTILITY[sku]
    const metallic = TAMIYA_METALLIC.has(sku)
    const clear = TAMIYA_CLEAR.test(sku)
    // The thumbnail names the colour chip (…/81762/81762_s.jpg); _1 is the large one.
    const large = item.thumb.replace(/_s\.jpg$/, '_1.jpg')
    let hex = ''
    let swatch = ''
    if (!utility) {
      const file = await cached(large, `tamiya/${sku}.jpg`)
      swatch = path.join(SWATCHES, 'tamiya-acrylic', `${sku.toLowerCase()}.png`)
      // Inside the hexagon, clear of the code printed at the bottom right.
      hex = await swatchFrom(file, [0.15, 0.25, 0.4], swatch)
    }
    rows.push({
      brand: 'Tamiya',
      line: 'Acrylic Paint',
      sku,
      name,
      hex,
      paint_type: utility ?? (metallic ? 'metallic' : 'acrylic'),
      finish: utility === 'varnish' ? 'varnish' : metallic ? 'metallic' : clear ? 'transparent' : sku.startsWith('XF') ? 'matte' : sku === 'X-18' ? 'satin' : 'gloss',
      finish_type: metallic ? 'metallic' : utility === 'varnish' ? 'varnish' : 'standard',
      product_url: item.url,
      image_url: utility ? '' : large,
      swatch_file: swatch ? path.relative(ROOT, swatch).replaceAll('\\', '/') : '',
      size: item.size,
    })
  }
  return rows
}

async function contactSheet(rows, file) {
  const perRow = 12
  const tile = 100
  const sheet = createCanvas(perRow * tile, Math.ceil(rows.length / perRow) * (tile + 26))
  const ctx = sheet.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  for (const [i, row] of rows.entries()) {
    const left = (i % perRow) * tile
    const top = Math.floor(i / perRow) * (tile + 26)
    if (row.swatch_file) ctx.drawImage(await loadImage(await sharp(path.join(ROOT, row.swatch_file)).resize(70, 70).png().toBuffer()), left + 4, top + 4)
    ctx.fillStyle = row.hex || '#fff'
    ctx.fillRect(left + 76, top + 4, 18, 70)
    ctx.fillStyle = '#000'
    ctx.font = '10px sans-serif'
    ctx.fillText(`${row.sku} ${row.hex}`, left + 4, top + 88)
    ctx.fillText(row.name.slice(0, 17), left + 4, top + 100)
  }
  fs.writeFileSync(file, sheet.toBuffer('image/png'))
}

async function main() {
  const columns = ['brand', 'line', 'sku', 'name', 'hex', 'paint_type', 'finish', 'finish_type', 'product_url', 'image_url', 'swatch_file']

  const rc = await realColors()
  fs.mkdirSync(path.join(ROOT, 'data', 'conversion-charts', 'ak-interactive'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'data', 'conversion-charts', 'ak-interactive', 'real-colors-catalog.csv'), csv(rc, columns))
  await contactSheet(rc, path.join(SWATCHES, 'real-colors-contact-sheet.png'))
  console.log(`Real Colors: ${rc.length} paints`)

  const tamiya = await tamiyaAcrylics()
  fs.mkdirSync(path.join(ROOT, 'data', 'conversion-charts', 'tamiya'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'data', 'conversion-charts', 'tamiya', 'acrylic-catalog.csv'), csv(tamiya, [...columns, 'size']))
  await contactSheet(tamiya, path.join(SWATCHES, 'tamiya-acrylic-contact-sheet.png'))
  console.log(`Tamiya acrylics: ${tamiya.length} paints (${tamiya.filter((r) => r.size === '10ml').length} Mini-only)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
