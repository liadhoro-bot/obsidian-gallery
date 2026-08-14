#!/usr/bin/env node
// Small sharp-based helpers for the OG-WDS asset pipeline.
//
// Rule this script exists to support: raster assets may only be (1) small
// tileable material-grain fills, or (2) small fixed-aspect isolated hardware
// icons. Never crop a full framed panel/card/control and stretch it with
// `background-size: 100% 100%` into an arbitrarily-proportioned live layout
// box — see references/asset-pipeline.md for why.
//
// Usage: node crop-tileable-asset.mjs <command> [json-args]
//   node crop-tileable-asset.mjs cropTile '{"src":"...","out":"...","left":0,"top":0,"width":400,"height":400,"outSize":448}'
//   node crop-tileable-asset.mjs isolateCircleIcon '{"src":"...","out":"...","left":0,"top":0,"width":140,"height":140,"outSize":96}'
//   node crop-tileable-asset.mjs noiseGrain '{"out":"...","size":512,"baseFrequency":0.9,"seed":7,"rgb":[0.86,0.78,0.64]}'

import sharp from 'sharp';
import { pathToFileURL } from 'node:url';

export async function cropTile({ src, out, left, top, width, height, outSize }) {
  await sharp(src)
    .extract({ left, top, width, height })
    .resize(outSize, outSize, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

export async function isolateCircleIcon({ src, out, left, top, width, height, outSize }) {
  const mask = Buffer.from(
    `<svg width="${outSize}" height="${outSize}"><circle cx="${outSize / 2}" cy="${outSize / 2}" r="${outSize / 2}" fill="#fff"/></svg>`
  );
  await sharp(src)
    .extract({ left, top, width, height })
    .resize(outSize, outSize, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(out);
  return out;
}

// Turns a non-seamless source crop into a tileable one via quadrant-swap
// (toroidal offset) plus a blurred seam strip at the new center cross, where
// the original left/right and top/bottom edges now meet. Use this whenever a
// plain crop shows a visible repeat seam at tile scale (e.g. wide desktop
// backgrounds where many repeats are visible at once).
export async function makeSeamlessTile({ src, out, outSize = 700, seamBlur = 18, seamFraction = 0.16 }) {
  const meta = await sharp(src).metadata();
  const w = meta.width;
  const h = meta.height;
  const halfW = Math.round(w / 2);
  const halfH = Math.round(h / 2);

  const [tl, tr, bl, br] = await Promise.all([
    sharp(src).extract({ left: 0, top: 0, width: halfW, height: halfH }).toBuffer(),
    sharp(src).extract({ left: halfW, top: 0, width: w - halfW, height: halfH }).toBuffer(),
    sharp(src).extract({ left: 0, top: halfH, width: halfW, height: h - halfH }).toBuffer(),
    sharp(src).extract({ left: halfW, top: halfH, width: w - halfW, height: h - halfH }).toBuffer(),
  ]);

  const offsetBuf = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 30, b: 22 } } })
    .composite([
      { input: br, left: 0, top: 0 },
      { input: bl, left: w - halfW, top: 0 },
      { input: tr, left: 0, top: h - halfH },
      { input: tl, left: w - halfW, top: h - halfH },
    ])
    .png()
    .toBuffer();

  const stripW = Math.round(w * seamFraction);
  const stripH = Math.round(h * seamFraction);
  const [vStrip, hStrip] = await Promise.all([
    sharp(offsetBuf).extract({ left: Math.round(w / 2 - stripW / 2), top: 0, width: stripW, height: h }).blur(seamBlur).toBuffer(),
    sharp(offsetBuf).extract({ left: 0, top: Math.round(h / 2 - stripH / 2), width: w, height: stripH }).blur(seamBlur).toBuffer(),
  ]);

  await sharp(offsetBuf)
    .composite([
      { input: vStrip, left: Math.round(w / 2 - stripW / 2), top: 0 },
      { input: hStrip, left: 0, top: Math.round(h / 2 - stripH / 2) },
    ])
    .resize(outSize, outSize)
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

// Worn/aged metal texture: layers a coarse low-frequency "patina blotch" noise
// under a fine high-frequency "brushed/scratched" noise, both tinted toward
// the target metal color. Meant to sit UNDER a plain base-color gradient in a
// material composite so the metal reads as hand-finished/tarnished rather
// than a smooth, glossy, digital-looking gradient. Output has alpha, so it
// modulates whatever's beneath it rather than fully replacing the color.
export async function wornMetalTexture({ out, size = 384, seed = 11, patinaRgb, grainRgb, patinaAlpha = 0.3, grainAlpha = 0.32 }) {
  const [pr, pg, pb] = patinaRgb; // darker/desaturated tarnish tone, 0-1 floats
  const [gr, gg, gb] = grainRgb; // base metal tone for fine grain, 0-1 floats
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <filter id="patina">
      <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${pr}  0 0 0 0 ${pg}  0 0 0 0 ${pb}  0 0 0 ${patinaAlpha} 0"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 5}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${gr}  0 0 0 0 ${gg}  0 0 0 0 ${gb}  0 0 0 ${grainAlpha} 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#patina)"/>
    <rect width="100%" height="100%" filter="url(#grain)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  return out;
}

// Directional "brushed metal" texture: anisotropic feTurbulence (different X/Y
// baseFrequency creates elongated streaks along one axis) layered over a
// coarse patina-blotch base, both with stitchTiles="stitch" so it's seamless
// by construction. Use this instead of a real photo crop for brushed-metal
// looks - a photo crop's streaks rarely repeat cleanly at small tile sizes,
// this always does. direction 'horizontal' streaks run left-right.
export async function brushedMetalTexture({ out, size = 384, seed = 11, direction = 'horizontal', streakFreq = 0.9, lengthFreq = 0.025, patinaRgb, grainRgb, patinaAlpha = 0.28, grainAlpha = 0.4 }) {
  const [fx, fy] = direction === 'horizontal' ? [lengthFreq, streakFreq] : [streakFreq, lengthFreq];
  const [pr, pg, pb] = patinaRgb;
  const [gr, gg, gb] = grainRgb;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <filter id="patina">
      <feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="2" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${pr}  0 0 0 0 ${pg}  0 0 0 0 ${pb}  0 0 0 ${patinaAlpha} 0"/>
    </filter>
    <filter id="brush">
      <feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="2" seed="${seed + 7}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${gr}  0 0 0 0 ${gg}  0 0 0 0 ${gb}  0 0 0 ${grainAlpha} 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#patina)"/>
    <rect width="100%" height="100%" filter="url(#brush)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  return out;
}

// Fallback only: use when no source crop yields usable grain. baseFrequency
// ~0.7-1.1 gives fine paper/wood-scale grain; lower values look coarser/blotchy.
export async function noiseGrain({ out, size = 512, baseFrequency = 0.9, seed = 7, rgb, alpha = 0.22 }) {
  const [r, g, b] = rgb; // 0-1 floats, derived from the target token hex
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="3" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${alpha} 0"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#n)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
  return out;
}

async function main() {
  const [, , command, argsJson] = process.argv;
  const fns = { cropTile, isolateCircleIcon, noiseGrain, makeSeamlessTile, wornMetalTexture, brushedMetalTexture };
  if (!command || !fns[command]) {
    console.error('Usage: node crop-tileable-asset.mjs <cropTile|isolateCircleIcon|noiseGrain> \'<json-args>\'');
    process.exit(1);
  }
  const args = JSON.parse(argsJson);
  const out = await fns[command](args);
  console.log('wrote', out);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
