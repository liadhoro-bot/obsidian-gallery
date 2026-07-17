import { createCanvas } from "@napi-rs/canvas";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const workspace = "C:/Users/Liad/obsidian-gallery";
const sourceCsv = path.join(workspace, "downloads", "reference", "army-painter-missing-paints-paint-dataset.csv");
const reportCsv = path.join(workspace, "downloads", "reference", "army-painter-missing-paints-report.csv");
const outDir = path.join(workspace, "downloads");
const uploadDir = path.join(outDir, "supabase-upload");
const referenceDir = path.join(outDir, "reference");
const brand = "Army Painter";
const brandSlug = "army-painter";
const storageBase = "https://ckzrvjisesooqcmmtvwl.supabase.co/storage/v1/object/public/paint-swatches";
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

const colorHints = new Map(Object.entries({
  "Historical|Red Flag": "#B51D2A",
  "Speedpaint|Bony Matter": "#D8C796",
  "Speedpaint|Maggot Skin": "#AAB85D",
  "Speedpaint|Ochre Clay": "#B57B35",
  "Speedpaint|Peachy Flesh": "#E79F77",
  "Warpaints Air|Anti-shine Varnish": "#F6F2E8",
  "Warpaints Air|Archangel Red": "#D91920",
  "Warpaints Air|Azure Magic": "#58C7E8",
  "Warpaints Air|Blanched Bone": "#E8D7AD",
  "Warpaints Air|Blue Flux": "#00A3D8",
  "Warpaints Air|Bogey Green": "#80A74B",
  "Warpaints Air|Brethril Blush": "#E08A8E",
  "Warpaints Air|Bullwhack Brown": "#8A4C2F",
  "Warpaints Air|Charred Bone": "#B59F78",
  "Warpaints Air|Cypress Brown": "#5C3B2E",
  "Warpaints Air|Dark Sky": "#2F4659",
  "Warpaints Air|Drab Green": "#596843",
  "Warpaints Air|Elemental Bolt": "#39D4EA",
  "Warpaints Air|Elven Armor": "#8FD8E8",
  "Warpaints Air|Elven Flesh": "#F0B48F",
  "Warpaints Air|Encarmine Red": "#A91524",
  "Warpaints Air|Fairy Dust": "#E9D8FF",
  "Warpaints Air|Fairy Pink": "#F3A1C4",
  "Warpaints Air|Feral Green": "#3C7D3C",
  "Warpaints Air|Fey Pink": "#D9519A",
  "Warpaints Air|Feywild Glow": "#F5C1D8",
  "Warpaints Air|Gauss Green": "#83F05D",
  "Warpaints Air|Gemstone": "#2A67B1",
  "Warpaints Air|Glitter Green": "#60C27A",
  "Warpaints Air|Gnome Cheeks": "#F0A28D",
  "Warpaints Air|Goblin Green": "#4AA13D",
  "Warpaints Air|Gremlin Green": "#6AA84F",
  "Warpaints Air|Hazardous Smog": "#A8D6B2",
  "Warpaints Air|Hobgoblin Hue": "#C47C36",
  "Warpaints Air|Hot Pink": "#F03090",
  "Warpaints Air|Imp Yellow": "#F4D331",
  "Warpaints Air|Incursion Orange": "#F05A28",
  "Warpaints Air|Ionic Blue": "#0074BA",
  "Warpaints Air|Iron Wolf": "#7A858B",
  "Warpaints Air|Kobold Skin": "#B27654",
  "Warpaints Air|Leviathan Light": "#B6E2E5",
  "Warpaints Air|Magnolia Brown": "#9B6A4C",
  "Warpaints Air|Majestic Fortress": "#6E8795",
  "Warpaints Air|Militia Green": "#738057",
  "Warpaints Air|Molten Orange": "#E83D22",
  "Warpaints Air|Neon Yellow": "#E8F13C",
  "Warpaints Air|Night Scales": "#29324C",
  "Warpaints Air|Nomad Flesh": "#D89A70",
  "Warpaints Air|Ocean Depths": "#005C78",
  "Warpaints Air|Orange Magma": "#FF7A1B",
  "Warpaints Air|Pestilent Flesh": "#B7C17B",
  "Warpaints Air|Phantasmal Blue": "#7ED6F2",
  "Warpaints Air|Potion Green": "#26B86F",
  "Warpaints Air|Psychic Shock": "#3B74E8",
  "Warpaints Air|Rawhide Brown": "#A76B3B",
  "Warpaints Air|Royal Purple": "#55318E",
  "Warpaints Air|Ruinous Spell": "#692B8F",
  "Warpaints Air|Safety Orange": "#FF7F24",
  "Warpaints Air|Sapphire Gem": "#1357A6",
  "Warpaints Air|Savage Green": "#2F7E45",
  "Warpaints Air|Storm Wolf": "#8B9CAA",
  "Warpaints Air|Talisman Purple": "#7D3FA1",
  "Warpaints Air|Thunder Storm": "#546D83",
  "Warpaints Air|Toxic Mist": "#96D89E",
  "Warpaints Air|Twilight Sky": "#4C5D88",
  "Warpaints Air|Violet Volt": "#B13EC9",
  "Warpaints Air|Warlock Purple": "#8A245D",
  "Warpaints Air|Wildling Flesh": "#C78A68",
  "Warpaints Air|Witchbane Plum": "#6F315E",
  "Warpaints Air|Wizards Orb": "#1DA7C7",
  "Warpaints Air|Zephyr Pink": "#F6B6D6",
  "Warpaints Air|Zombie Flesh": "#9CA876",
  "Warpaints Fanatic|Violent Vermillion": "#F24422",
  "Warpaints Fanatic Effects|Brush-On Primer": "#E7E2D3",
  "Warpaints Fanatic Effects|Dark Rust": "#6E2F1D",
  "Warpaints Fanatic Effects|Data System Glow": "#26F0D9",
  "Warpaints Fanatic Effects|Disgusting Slime": "#9BCB32",
  "Warpaints Fanatic Effects|Dry Blood": "#5F1217",
  "Warpaints Fanatic Effects|Fresh Rust": "#B94D22",
  "Warpaints Fanatic Effects|Gloss Varnish": "#F7F3EA",
  "Warpaints Fanatic Effects|Lens Flare Glow": "#FFE64A",
  "Warpaints Fanatic Effects|Matt Varnish": "#F3EFE5",
  "Warpaints Fanatic Effects|Oil Stains": "#1F1B18",
  "Warpaints Fanatic Effects|Oozing Vomit": "#C6B33D",
  "Warpaints Fanatic Effects|Plasma Coil Glow": "#3DE7FF",
  "Warpaints Fanatic Effects|Power Node Glow": "#35A2FF",
  "Warpaints Fanatic Effects|Radiation Glow": "#8CFF45",
  "Warpaints Fanatic Effects|Retarder": "#F4F1E9",
  "Warpaints Fanatic Effects|Stabilizer": "#F5F1E8",
  "Warpaints Fanatic Effects|True Blood": "#9A1018",
  "Warpaints Fanatic Effects|Verdigris": "#4BBF9B",
}));

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

function stableUuid(value) {
  const hash = crypto.createHash("sha1").update(value).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function skuFor(row) {
  const prefixes = {
    "Historical": "AP-HIST",
    "Speedpaint": "AP-SP",
    "Warpaints Air": "AP-AIR",
    "Warpaints Fanatic": "AP-WPF",
    "Warpaints Fanatic Effects": "AP-FX",
  };
  return `${prefixes[row.line] ?? "AP"}-${slugify(row.name).toUpperCase()}`;
}

function swatchStyle(row) {
  if (row.paint_type === "speedpaint") return "transparent";
  if (row.finish === "metallic") return "metallic";
  if (row.finish === "varnish" || /varnish|retarder|stabilizer|primer/i.test(row.name)) return "utility";
  if (/glow|neon|plasma|radiation|flare|node/i.test(row.name)) return "glow";
  return "paint";
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]) {
  return [r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("").toUpperCase().replace(/^/, "#");
}

function mix(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

function renderSwatch(hex, style) {
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext("2d");
  const base = hexToRgb(hex);
  const light = mix(base, [255, 255, 255], style === "transparent" ? 0.58 : 0.28);
  const dark = mix(base, [0, 0, 0], style === "utility" ? 0.08 : 0.24);
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, rgbToHex(light));
  gradient.addColorStop(style === "metallic" ? 0.42 : 0.55, hex);
  gradient.addColorStop(1, rgbToHex(dark));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  if (style === "metallic") {
    ctx.globalAlpha = 0.24;
    for (let x = -240; x < 320; x += 36) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(x, 256);
      ctx.lineTo(x + 68, 256);
      ctx.lineTo(x + 240, 0);
      ctx.lineTo(x + 172, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (style === "glow") {
    const glow = ctx.createRadialGradient(82, 72, 12, 82, 72, 180);
    glow.addColorStop(0, "rgba(255,255,255,0.65)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
  }

  if (style === "transparent" || style === "utility") {
    ctx.globalAlpha = style === "transparent" ? 0.24 : 0.18;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(68, 54, 120, 58, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  return canvas;
}

function validate(rows, pngPaths) {
  const ids = new Set();
  for (const row of rows) {
    for (const column of columns) {
      if (!row[column] && !["finish", "paint_type"].includes(column)) {
        throw new Error(`Missing ${column} for ${row.line} / ${row.name}`);
      }
    }
    if (ids.has(row.id)) throw new Error(`Duplicate id ${row.id}`);
    ids.add(row.id);
  }
  const csvNames = new Set(rows.map((row) => {
    const parts = new URL(row.swatch_image_url).pathname.split("/");
    return `${parts.at(-2)}/${parts.at(-1)}`;
  }));
  const pngNames = new Set(pngPaths.map((item) => `${item.lineSlug}/${path.basename(item.path)}`));
  const missing = [...csvNames].filter((name) => !pngNames.has(name));
  const extra = [...pngNames].filter((name) => !csvNames.has(name));
  if (missing.length || extra.length) throw new Error(`PNG/CSV mismatch. Missing: ${missing.join(", ")} Extra: ${extra.join(", ")}`);
}

await fs.mkdir(uploadDir, { recursive: true });
await fs.mkdir(referenceDir, { recursive: true });
const sourceRows = parseCsv(await fs.readFile(sourceCsv, "utf8"));
const reportRows = parseCsv(await fs.readFile(reportCsv, "utf8"));
const sourceByKey = new Map(reportRows.map((row) => [`${row.line}|${row.name}`, row]));
const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
const rows = [];
const pngPaths = [];
const enrichmentRows = [];

for (const row of sourceRows) {
  const lineSlug = slugify(row.line);
  const paintSlug = slugify(row.name);
  const sku = skuFor(row);
  const filename = `${slugify(sku)}_${paintSlug}.png`;
  const hex = colorHints.get(`${row.line}|${row.name}`) ?? "#888888";
  const imageRoot = path.join(outDir, "paint-swatches", brandSlug, lineSlug);
  await fs.mkdir(imageRoot, { recursive: true });
  const pngPath = path.join(imageRoot, filename);
  const canvas = renderSwatch(hex, swatchStyle(row));
  await fs.writeFile(pngPath, canvas.toBuffer("image/png"));
  pngPaths.push({ path: pngPath, lineSlug });

  rows.push({
    id: stableUuid(`${brand}:${row.line}:${row.name}`),
    brand,
    line: row.line,
    name: row.name,
    sku,
    swatch_image_url: `${storageBase}/${brandSlug}/${lineSlug}/${filename}`,
    hex_approx: hex,
    finish: row.finish,
    paint_type: row.paint_type,
    is_active: "true",
    created_at: createdAt,
  });

  const source = sourceByKey.get(`${row.line}|${row.name}`);
  enrichmentRows.push({
    line: row.line,
    name: row.name,
    generated_sku: sku,
    source_sets: source?.source_sets ?? "",
    source_item_name: source?.source_item_name ?? "",
    hex_approx: hex,
    swatch_style: swatchStyle(row),
    note: "Generated from source paint name and curated approximate color; source_sets retained for traceability.",
  });
}

validate(rows, pngPaths);

for (const file of await fs.readdir(uploadDir)) {
  if (file.startsWith("army-painter-missing-")) await fs.rm(path.join(uploadDir, file), { force: true });
}

const lineGroups = new Map();
for (const row of rows) {
  lineGroups.set(row.line, [...(lineGroups.get(row.line) ?? []), row]);
}

for (const [line, lineRows] of [...lineGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const lineSlug = slugify(line);
  const csv = [
    columns.join(","),
    ...lineRows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\r\n") + "\r\n";
  await fs.writeFile(path.join(uploadDir, `army-painter-missing-${lineSlug}_paint_dataset.csv`), csv, "utf8");

  const zip = new JSZip();
  const folder = zip.folder(`paint-swatches/${brandSlug}/${lineSlug}`);
  for (const item of pngPaths.filter((pathItem) => pathItem.lineSlug === lineSlug)) {
    folder.file(path.basename(item.path), await fs.readFile(item.path));
  }
  await fs.writeFile(
    path.join(uploadDir, `army-painter-missing-${lineSlug}_paint_swatches.zip`),
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
}

const allCsv = [
  columns.join(","),
  ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
].join("\r\n") + "\r\n";
await fs.writeFile(path.join(referenceDir, "army-painter-missing-paints-enriched-reference.csv"), allCsv, "utf8");

const enrichmentHeader = ["line", "name", "generated_sku", "source_sets", "source_item_name", "hex_approx", "swatch_style", "note"];
await fs.writeFile(
  path.join(referenceDir, "army-painter-missing-paints-enrichment-report.csv"),
  [
    enrichmentHeader.join(","),
    ...enrichmentRows.map((row) => enrichmentHeader.map((column) => csvEscape(row[column])).join(",")),
  ].join("\r\n") + "\r\n",
  "utf8",
);

console.log(`Rows: ${rows.length}`);
for (const [line, lineRows] of [...lineGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`${line}: ${lineRows.length}`);
}
console.log(`Upload files: ${uploadDir}`);
