import { createCanvas } from "@napi-rs/canvas";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";

const source = "C:/Users/Liad/Downloads/CC339-True_Metallic_Metal (1).pdf";
const outDir = "C:/Users/Liad/obsidian-gallery/downloads";
const uploadDir = path.join(outDir, "supabase-upload");
const brand = "Vallejo";
const brandSlug = "vallejo";
const brandRoot = path.join(outDir, "paint-swatches", brandSlug);
const storageBase =
  "https://ckzrvjisesooqcmmtvwl.supabase.co/storage/v1/object/public/paint-swatches";
const lineDefinitions = {
  Light: { name: "True Metallic Metal Light", slug: "true-metallic-metal-light" },
  Base: { name: "True Metallic Metal Base", slug: "true-metallic-metal-base" },
  Shade: { name: "True Metallic Metal Shade", slug: "true-metallic-metal-shade" },
  Airbrush: { name: "True Metallic Metal Airbrush", slug: "true-metallic-metal-airbrush" },
};
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

function stableUuid(value) {
  const hash = crypto.createHash("sha1").update(value).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function dominantHex(imageData) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = 24; y < 232; y += 1) {
    for (let x = 24; x < 232; x += 1) {
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

function variantFor(sku) {
  const number = Number(sku.split(".")[1]);
  if (number >= 101 && number <= 120) return "Light";
  if (number >= 121 && number <= 140) return "Base";
  if (number >= 141 && number <= 160) return "Shade";
  if (number >= 161 && number <= 180) return "Airbrush";
  return "";
}

function nextName(items, skuIndex) {
  for (let index = skuIndex + 1; index < Math.min(skuIndex + 4, items.length); index += 1) {
    const text = items[index].str.trim();
    if (text && !/^77\.\d{3}$/.test(text)) return text;
  }
  return "";
}

function validate(rows, pngNames) {
  const ids = new Set();
  const csvNames = new Set();
  for (const row of rows) {
    for (const column of columns) {
      if (!row[column] && !["finish", "paint_type"].includes(column)) {
        throw new Error(`Missing ${column} for ${row.sku}`);
      }
    }
    if (ids.has(row.id)) throw new Error(`Duplicate id: ${row.id}`);
    ids.add(row.id);
    const urlParts = new URL(row.swatch_image_url).pathname.split("/");
    csvNames.add(`${urlParts.at(-2)}/${urlParts.at(-1)}`);
  }
  const missing = [...csvNames].filter((name) => !pngNames.has(name));
  const extra = [...pngNames].filter((name) => !csvNames.has(name));
  if (missing.length || extra.length) {
    throw new Error(`PNG/CSV mismatch. Missing: ${missing.join(", ")} Extra: ${extra.join(", ")}`);
  }
}

await fs.rm(path.join(brandRoot, "true-metallic-metal"), { recursive: true, force: true });
for (const definition of Object.values(lineDefinitions)) {
  const imageRoot = path.join(brandRoot, definition.slug);
  await fs.rm(imageRoot, { recursive: true, force: true });
  await fs.mkdir(imageRoot, { recursive: true });
}
await fs.mkdir(uploadDir, { recursive: true });
for (const file of await fs.readdir(uploadDir)) {
  if (file.startsWith("vallejo_true-metallic-metal")) {
    await fs.rm(path.join(uploadDir, file), { force: true });
  }
}

const data = new Uint8Array(await fs.readFile(source));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;

const namesPage = await pdf.getPage(1);
const namesText = await namesPage.getTextContent();
const namesItems = namesText.items.filter((item) => item.str && item.str.trim());
const baseNames = new Map();
for (let index = 0; index < namesItems.length; index += 1) {
  const sku = namesItems[index].str.trim();
  if (/^77\.\d{3}$/.test(sku)) baseNames.set(sku, nextName(namesItems, index));
}

const swatchPage = await pdf.getPage(2);
const scale = 2.5;
const viewport = swatchPage.getViewport({ scale });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const context = canvas.getContext("2d");
await swatchPage.render({ canvasContext: context, viewport }).promise;
const swatchText = await swatchPage.getTextContent();
const skuPositions = [];
for (const item of swatchText.items) {
  const sku = String(item.str || "").trim();
  if (!/^77\.\d{3}$/.test(sku)) continue;
  const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
  skuPositions.push({ sku, x: Math.round(x), y: Math.round(y) });
}
skuPositions.sort((a, b) => a.y - b.y || a.x - b.x);

const rows = [];
const zip = new JSZip();
const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
const pngNames = new Set();

for (const position of skuPositions) {
  const variant = variantFor(position.sku);
  const line = lineDefinitions[variant];
  const baseName = baseNames.get(position.sku) || position.sku;
  const name = `${baseName} ${variant}`.trim();
  const imageRoot = path.join(brandRoot, line.slug);
  const cropSize = 60;
  const cropX = position.x - 3;
  const cropY = position.y - 90;
  const swatch = createCanvas(256, 256);
  const swatchContext = swatch.getContext("2d");
  swatchContext.imageSmoothingEnabled = true;
  swatchContext.imageSmoothingQuality = "high";
  swatchContext.drawImage(canvas, cropX, cropY, cropSize, cropSize, 0, 0, 256, 256);

  const filename = `${slugify(position.sku)}_${slugify(name)}.png`;
  const pngBuffer = swatch.toBuffer("image/png");
  await fs.writeFile(path.join(imageRoot, filename), pngBuffer);
  zip.folder(`paint-swatches/${brandSlug}/${line.slug}`).file(filename, pngBuffer);
  pngNames.add(`${line.slug}/${filename}`);

  rows.push({
    id: stableUuid(`${brand}:${line.name}:${position.sku}`),
    brand,
    line: line.name,
    name,
    sku: position.sku,
    swatch_image_url: `${storageBase}/${brandSlug}/${line.slug}/${filename}`,
    hex_approx: dominantHex(swatchContext.getImageData(0, 0, 256, 256)),
    finish: "metallic",
    paint_type: variant === "Airbrush" ? "airbrush acrylic" : "acrylic",
    is_active: "true",
    created_at: createdAt,
  });
}

validate(rows, pngNames);

const csv = [
  columns.join(","),
  ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
].join("\r\n") + "\r\n";
const referenceDir = path.join(outDir, "reference");
await fs.mkdir(referenceDir, { recursive: true });
const csvPath = path.join(referenceDir, "vallejo_true-metallic-metal_all_reference.csv");
const zipPath = path.join(referenceDir, "vallejo_true-metallic-metal_all_reference.zip");
await fs.writeFile(csvPath, csv, "utf8");
await fs.writeFile(zipPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

for (const definition of Object.values(lineDefinitions)) {
  const lineRows = rows.filter((row) => row.line === definition.name);
  const lineCsv = [
    columns.join(","),
    ...lineRows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\r\n") + "\r\n";
  await fs.writeFile(
    path.join(uploadDir, `vallejo_${definition.slug}_paint_dataset.csv`),
    lineCsv,
    "utf8",
  );

  const lineZip = new JSZip();
  const lineZipFolder = lineZip.folder(`paint-swatches/${brandSlug}/${definition.slug}`);
  const imageRoot = path.join(brandRoot, definition.slug);
  const pngFiles = (await fs.readdir(imageRoot)).filter((name) => name.endsWith(".png"));
  for (const pngFile of pngFiles) {
    lineZipFolder.file(pngFile, await fs.readFile(path.join(imageRoot, pngFile)));
  }
  await fs.writeFile(
    path.join(uploadDir, `vallejo_${definition.slug}_paint_swatches.zip`),
    await lineZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

console.log(`Rows: ${rows.length}`);
console.log(`Reference CSV: ${csvPath}`);
console.log(`Reference ZIP: ${zipPath}`);
for (const definition of Object.values(lineDefinitions)) {
  console.log(`${definition.name}: ${rows.filter((row) => row.line === definition.name).length}`);
}
