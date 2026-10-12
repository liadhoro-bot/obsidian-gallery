/**
 * P3 Formula swatches are product photos: a bottle on a background painted in
 * the paint's colour (metallics get a sheen gradient). In the paint cards the
 * bottle ends up stuck in the frame, so this rebuilds each swatch from the
 * background alone: the strips left and right of the bottle, joined and
 * scaled to 256px. The vertical gradient survives; the bottle doesn't.
 *
 *   npx tsx --env-file=.env.local scripts/rebuild-p3-formula-swatches.ts           # dry run + contact sheet
 *   npx tsx --env-file=.env.local scripts/rebuild-p3-formula-swatches.ts --apply   # replace in the bucket
 *
 * Swatches replace the photos at their existing storage paths, so P3 keeps
 * the same layout as every other brand. The photos are kept locally in
 * scripts/output/p3-swatches/originals/ and re-used from there, so a re-run
 * never treats an already rebuilt swatch as a photo; upload them back to
 * roll back. Writes scripts/output/p3-swatches-applied.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createScriptClient } from './lib/script-supabase'
import { deltaE2000, hexToLab } from '../utils/paint-conversions/color'

const APPLY = process.argv.includes('--apply')
const OUT = path.join(process.cwd(), 'scripts', 'output', 'p3-swatches')
const ORIGINALS = path.join(OUT, 'originals')
const APPLIED = path.join(process.cwd(), 'scripts', 'output', 'p3-swatches-applied.json')
// Share of the photo's width on each side that is background only.
const STRIP = 0.28
const supabase = createScriptClient()
// Hoskune Red's legacy hex is a grey-pink; its swatch is a dark red-brown.
const HEX_FIXES = new Set(['Hoskune Red'])

async function backgroundSwatch(photo: Buffer) {
  const image = sharp(photo).removeAlpha()
  const { width = 512, height = 512 } = await image.metadata()
  const strip = Math.floor(width * STRIP)
  // The bottle casts a shadow along the bottom edge.
  const body = Math.floor(height * 0.85)
  const left = await sharp(photo).removeAlpha().extract({ left: 0, top: 0, width: strip, height: body }).toBuffer()
  const right = await sharp(photo).removeAlpha().extract({ left: width - strip, top: 0, width: strip, height: body }).toBuffer()
  const swatch = await sharp({ create: { width: strip * 2, height: body, channels: 3, background: '#000' } })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: strip, top: 0 },
    ])
    .png()
    .toBuffer()
  const resized = await sharp(swatch).resize(256, 256, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  // Background colour at mid height, left of the bottle.
  const { data } = await sharp(photo)
    .removeAlpha()
    .extract({ left: Math.floor(strip * 0.2), top: Math.floor(height * 0.4), width: Math.floor(strip * 0.6), height: Math.floor(height * 0.2) })
    .raw()
    .toBuffer({ resolveWithObject: true })
  let r = 0, g = 0, b = 0
  const n = data.length / 3
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  const hex = '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return { png: resized, hex }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { data: paints, error } = await supabase
    .from('paint_catalog')
    .select('id, line, name, hex_approx, swatch_image_url')
    .eq('brand', 'P3 Formula')
    .order('line')
    .order('name')
  if (error) throw error

  const results = []
  for (const paint of paints ?? []) {
    const url = paint.swatch_image_url as string | null
    if (!url) continue
    // An earlier run stored swatches under <line>/swatch/; fold them back.
    const objectPath = new URL(url).pathname.split('/paint-swatches/')[1].replace('/swatch/', '/')
    const original = path.join(ORIGINALS, objectPath)
    if (!fs.existsSync(original)) {
      const photoUrl = supabase.storage.from('paint-swatches').getPublicUrl(objectPath).data.publicUrl
      const response = await fetch(photoUrl)
      if (!response.ok) throw new Error(`${photoUrl}: HTTP ${response.status}`)
      fs.mkdirSync(path.dirname(original), { recursive: true })
      fs.writeFileSync(original, Buffer.from(await response.arrayBuffer()))
    }
    const { png, hex } = await backgroundSwatch(fs.readFileSync(original))
    const file = path.join(OUT, path.basename(objectPath))
    fs.writeFileSync(file, png)
    const deltaE = paint.hex_approx ? deltaE2000(hexToLab(paint.hex_approx), hexToLab(hex)) : null
    results.push({ ...paint, objectPath, file, background_hex: hex, delta_e: deltaE })
  }

  // Contact sheet: new swatch, its catalog hex, and the background sample.
  const perRow = 10
  const tile = 110
  const sheet = createCanvas(perRow * tile, Math.ceil(results.length / perRow) * (tile + 28))
  const ctx = sheet.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  for (const [i, r] of results.entries()) {
    const left = (i % perRow) * tile
    const top = Math.floor(i / perRow) * (tile + 28)
    ctx.drawImage(await loadImage(await sharp(r.file).resize(80, 80).png().toBuffer()), left + 4, top + 4)
    ctx.fillStyle = r.hex_approx ?? '#fff'
    ctx.fillRect(left + 86, top + 4, 18, 40)
    ctx.fillStyle = r.background_hex
    ctx.fillRect(left + 86, top + 44, 18, 40)
    ctx.fillStyle = r.delta_e != null && r.delta_e > 5 ? '#c00' : '#000'
    ctx.font = '10px sans-serif'
    ctx.fillText(r.name.slice(0, 18), left + 4, top + 98)
    ctx.fillText(`${r.line.slice(0, 9)} ΔE ${r.delta_e?.toFixed(1) ?? '-'}`, left + 4, top + 110)
  }
  fs.writeFileSync(path.join(OUT, 'contact-sheet.png'), sheet.toBuffer('image/png'))
  const off = results.filter((r) => r.delta_e != null && r.delta_e > 5)
  console.log(`${results.length} swatches rebuilt; ${off.length} catalog hexes differ from the background by ΔE > 5:`)
  for (const r of off) console.log(`  ${r.line} ${r.name}: ${r.hex_approx} vs ${r.background_hex} (ΔE ${r.delta_e!.toFixed(1)})`)

  if (!APPLY) {
    console.log(`dry run; review ${path.join(OUT, 'contact-sheet.png')} then re-run with --apply`)
    return
  }

  const applied = []
  const stray = []
  for (const r of results) {
    const { error: uploadError } = await supabase.storage
      .from('paint-swatches')
      .upload(r.objectPath, fs.readFileSync(r.file), { contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError
    const swatchUrl = supabase.storage.from('paint-swatches').getPublicUrl(r.objectPath).data.publicUrl
    if (swatchUrl !== r.swatch_image_url) {
      const { error: updateError } = await supabase.from('paint_catalog').update({ swatch_image_url: swatchUrl }).eq('id', r.id)
      if (updateError) throw updateError
      stray.push(new URL(r.swatch_image_url!).pathname.split('/paint-swatches/')[1])
    }
    applied.push({ id: r.id, name: r.name, path: r.objectPath, original: path.relative(process.cwd(), path.join(ORIGINALS, r.objectPath)) })
  }
  if (stray.length) {
    const { error: removeError } = await supabase.storage.from('paint-swatches').remove(stray)
    if (removeError) throw removeError
  }
  console.log(`replaced ${applied.length} swatches in place; removed ${stray.length} objects from the earlier swatch/ folders`)
  // Catalog hexes that don't match their own swatch at all.
  const hexFixes = []
  for (const r of results.filter((r) => HEX_FIXES.has(r.name) && r.hex_approx !== r.background_hex)) {
    const lab = hexToLab(r.background_hex)
    const { error: hexError } = await supabase
      .from('paint_catalog')
      .update({ hex_approx: r.background_hex, hex_previous: r.hex_approx, hex_source: 'swatch_sample', hex_checked_at: new Date().toISOString(), lab_l: lab.l, lab_a: lab.a, lab_b: lab.b })
      .eq('id', r.id)
    if (hexError) throw hexError
    hexFixes.push({ id: r.id, name: r.name, from: r.hex_approx, to: r.background_hex })
  }
  console.log('hex fixes:', hexFixes)

  fs.writeFileSync(APPLIED, JSON.stringify({ at: new Date().toISOString(), applied, hexFixes }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
