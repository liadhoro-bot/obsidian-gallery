import { createCanvas } from "@napi-rs/canvas";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";

const source = "C:/Users/Liad/Downloads/CC064-MechaColor-Rev03-baja.pdf";
const outDir = "C:/Users/Liad/obsidian-gallery/downloads";
const uploadDir = path.join(outDir, "supabase-upload");
const referenceDir = path.join(outDir, "reference");
const brand = "Vallejo";
const brandSlug = "vallejo";
const brandRoot = path.join(outDir, "paint-swatches", brandSlug);
const storageBase =
  "https://ckzrvjisesooqcmmtvwl.supabase.co/storage/v1/object/public/paint-swatches";
const lineDefinitions = [
  { name: "Mecha Color", slug: "mecha-color" },
  { name: "Mecha Fluorescent", slug: "mecha-fluorescent" },
  { name: "Mecha Metallic", slug: "mecha-metallic" },
  { name: "Mecha Primer", slug: "mecha-primer" },
  { name: "Mecha Weathering", slug: "mecha-weathering" },
  { name: "Mecha Auxiliaries", slug: "mecha-auxiliaries" },
];
const lineBySlug = new Map(lineDefinitions.map((definition) => [definition.slug, definition]));

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dominantHex(imageData) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = 64; y < 192; y += 1) {
    for (let x = 64; x < 192; x += 1) {
      const offset = (y * 256 + x) * 4;
      r += imageData.data[offset];
      g += imageData.data[offset + 1];
      b += imageData.data[offset + 2];
      count += 1;
    }
  }
  return [r / count, g / count, b / count]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .replace(/^/, "#");
}

function finishFor(name) {
  if (/gloss/i.test(name)) return "gloss";
  if (/matt|matte/i.test(name)) return "matte";
  if (/satin/i.test(name)) return "satin";
  if (/fluorescent/i.test(name)) return "fluorescent";
  return "";
}

function paintTypeFor(sku, name) {
  if (lineFor(sku).slug === "mecha-primer") return "primer";
  if (/varnish/i.test(name)) return "varnish";
  if (/thinner|flow improver|decal softener|medium/i.test(name)) return "auxiliary";
  if (/wash|stains|spills|soot|texture/i.test(name)) return "weathering";
  return "acrylic";
}

function lineFor(sku) {
  if (/^70\.64/.test(sku)) return lineBySlug.get("mecha-primer");
  if (/^69\.05[4-7]$/.test(sku)) return lineBySlug.get("mecha-fluorescent");
  if (/^69\.0(5[8-9]|6[0-8])$/.test(sku)) return lineBySlug.get("mecha-metallic");
  if (/^69\.(50[57]|51[58]|52[12]|81[3478]|821)$/.test(sku)) return lineBySlug.get("mecha-weathering");
  if (/^(69\.70[1-3]|71\.26[12]|73\.21[24])$/.test(sku)) return lineBySlug.get("mecha-auxiliaries");
  return lineBySlug.get("mecha-color");
}

function nextName(items, skuIndex) {
  for (let index = skuIndex + 1; index < Math.min(skuIndex + 5, items.length); index += 1) {
    const text = items[index].str.trim();
    if (text && !/^(69|70|71|73)\.\d{3}$/.test(text) && !/^\d+ ml/.test(text)) {
      return text;
    }
  }
  return "";
}

await fs.rm(brandRoot, { recursive: true, force: true });
await fs.mkdir(brandRoot, { recursive: true });
await fs.rm(uploadDir, { recursive: true, force: true });
await fs.mkdir(uploadDir, { recursive: true });
await fs.mkdir(referenceDir, { recursive: true });

const data = new Uint8Array(await fs.readFile(source));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 2.5 });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const context = canvas.getContext("2d");
await page.render({ canvasContext: context, viewport }).promise;

const text = await page.getTextContent();
const items = text.items.filter((item) => item.str && item.str.trim());
const pairs = [];
for (let index = 0; index < items.length; index += 1) {
  const sku = items[index].str.trim();
  if (!/^(69|70|71|73)\.\d{3}$/.test(sku)) continue;

  const [x, y] = viewport.convertToViewportPoint(items[index].transform[4], items[index].transform[5]);
  if (x >= 2800) continue;

  pairs.push({
    sku,
    name: nextName(items, index),
    x: Math.round(x),
    y: Math.round(y),
  });
}
pairs.sort((a, b) => a.y - b.y || a.x - b.x);

const columns = [
  "id",
  "brand",
  "line",
  "name",
  "sku",
  "swatch_image_url",
  "hex_approx",
  "finish",
  "paint_type",
  "is_active",
  "created_at",
];
const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
const rows = [];
const combinedZip = new JSZip();

for (const pair of pairs) {
  const line = lineFor(pair.sku);
  const imageRoot = path.join(brandRoot, line.slug);
  await fs.mkdir(imageRoot, { recursive: true });
  const sourceWidth = 150;
  const squareSize = 106;
  const sourceX = pair.x;
  const sourceY = pair.y - 130;
  const cropX = sourceX + Math.round((sourceWidth - squareSize) / 2);
  const cropY = sourceY;
  const swatch = createCanvas(256, 256);
  const swatchContext = swatch.getContext("2d");
  swatchContext.imageSmoothingEnabled = true;
  swatchContext.imageSmoothingQuality = "high";
  swatchContext.drawImage(canvas, cropX, cropY, squareSize, squareSize, 0, 0, 256, 256);

  const filename = `${slugify(pair.sku)}_${slugify(pair.name)}.png`;
  const pngBuffer = swatch.toBuffer("image/png");
  await fs.writeFile(path.join(imageRoot, filename), pngBuffer);
  combinedZip.folder(`paint-swatches/${brandSlug}/${line.slug}`).file(filename, pngBuffer);

  rows.push({
    id: crypto.randomUUID(),
    brand,
    line: line.name,
    name: pair.name,
    sku: pair.sku,
    swatch_image_url: `${storageBase}/${brandSlug}/${line.slug}/${filename}`,
    hex_approx: dominantHex(swatchContext.getImageData(0, 0, 256, 256)),
    finish: finishFor(pair.name),
    paint_type: paintTypeFor(pair.sku, pair.name),
    is_active: "true",
    created_at: createdAt,
  });
}

const csv = [
  columns.join(","),
  ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
].join("\r\n") + "\r\n";
const csvPath = path.join(outDir, "vallejo_mecha_color_paint_dataset.csv");
const zipPath = path.join(outDir, "vallejo_mecha_color_paint_swatches.zip");
try {
  await fs.writeFile(csvPath, csv, "utf8");
  await fs.writeFile(zipPath, await combinedZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
} catch (error) {
  if (error?.code !== "EBUSY") throw error;
  console.warn("Skipped locked combined reference CSV/ZIP. Split upload files will still be regenerated.");
}
await fs.writeFile(path.join(referenceDir, "vallejo_all_mecha_lines_reference.csv"), csv, "utf8");

for (const definition of lineDefinitions) {
  const lineRows = rows.filter((row) => row.line === definition.name);
  const lineCsv = [
    columns.join(","),
    ...lineRows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\r\n") + "\r\n";
  const lineCsvPath = path.join(uploadDir, `vallejo_${definition.slug}_paint_dataset.csv`);
  await fs.writeFile(lineCsvPath, lineCsv, "utf8");

  const lineZip = new JSZip();
  const lineZipFolder = lineZip.folder(`paint-swatches/${brandSlug}/${definition.slug}`);
  const lineImageRoot = path.join(brandRoot, definition.slug);
  const pngFiles = await fs.readdir(lineImageRoot);
  for (const pngFile of pngFiles.filter((name) => name.endsWith(".png"))) {
    lineZipFolder.file(pngFile, await fs.readFile(path.join(lineImageRoot, pngFile)));
  }
  await fs.writeFile(
    path.join(uploadDir, `vallejo_${definition.slug}_paint_swatches.zip`),
    await lineZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

const pngNames = new Set();
for (const definition of lineDefinitions) {
  const lineImageRoot = path.join(brandRoot, definition.slug);
  for (const pngFile of (await fs.readdir(lineImageRoot)).filter((name) => name.endsWith(".png"))) {
    pngNames.add(`${definition.slug}/${pngFile}`);
  }
}
const csvNames = new Set(rows.map((row) => path.basename(new URL(row.swatch_image_url).pathname)));
const csvNamesWithLine = new Set(rows.map((row) => {
  const url = new URL(row.swatch_image_url);
  const parts = url.pathname.split("/");
  return `${parts.at(-2)}/${parts.at(-1)}`;
}));
const missing = [...csvNamesWithLine].filter((name) => !pngNames.has(name));
const extra = [...pngNames].filter((name) => !csvNamesWithLine.has(name));
if (missing.length || extra.length) {
  throw new Error(`PNG/CSV mismatch. Missing: ${missing.join(", ")} Extra: ${extra.join(", ")}`);
}

console.log(`Rows: ${rows.length}`);
console.log(`CSV: ${csvPath}`);
console.log(`ZIP: ${zipPath}`);
console.log(`PNGs: ${brandRoot}`);
console.log(`Upload files: ${uploadDir}`);
for (const definition of lineDefinitions) {
  console.log(`${definition.name}: ${rows.filter((row) => row.line === definition.name).length}`);
}
