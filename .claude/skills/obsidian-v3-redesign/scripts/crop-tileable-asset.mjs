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
  const fns = { cropTile, isolateCircleIcon, noiseGrain };
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
