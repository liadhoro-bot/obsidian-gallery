import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const workspace = "C:/Users/Liad/obsidian-gallery";
const uploadDir = path.join(workspace, "downloads", "supabase-upload");
const bucket = "paint-swatches";
const table = "paint_catalog";
const csvPrefix = "army-painter-missing-";
const csvSuffix = "_paint_dataset.csv";
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

function loadDotenvLocal() {
  const envPath = path.join(workspace, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (process.env[key]) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = splitCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]));
  });
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function finishTypeFor(row) {
  const text = `${row.finish} ${row.paint_type} ${row.name}`.toLowerCase();
  if (text.includes("metal")) return "metallic";
  if (text.includes("varnish")) return "varnish";
  if (text.includes("speedpaint")) return "contrast";
  if (text.includes("effect") || /glow|slime|blood|rust|stains|verdigris|primer|retarder|stabilizer/.test(text)) {
    return "technical";
  }
  return "standard";
}

function shouldColorMatch(row) {
  const text = `${row.finish} ${row.paint_type} ${row.name}`.toLowerCase();
  return !/varnish|retarder|stabilizer|primer/.test(text);
}

function storagePathFromUrl(url) {
  const pathname = new URL(url).pathname;
  const marker = `/${bucket}/`;
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Could not derive storage path from ${url}`);
  return decodeURIComponent(pathname.slice(markerIndex + marker.length));
}

function catalogPayload(row, id) {
  const colorMatchable = shouldColorMatch(row);
  return {
    id,
    brand: row.brand,
    line: row.line,
    name: row.name,
    sku: row.sku,
    swatch_image_url: row.swatch_image_url,
    hex_approx: row.hex_approx,
    finish: row.finish || null,
    paint_type: row.paint_type || null,
    is_active: row.is_active === "true",
    created_at: row.created_at,
    normalized_brand: normalize(row.brand),
    normalized_line: normalize(row.line),
    normalized_name: normalize(row.name),
    finish_type: finishTypeFor(row),
    color_match_enabled: colorMatchable,
    color_match_exclude_reason: colorMatchable ? null : "Utility paint generated from missing-paint import.",
    is_color_matchable: colorMatchable,
    is_conversion_matchable: true,
  };
}

async function loadRows() {
  const files = (await readdir(uploadDir))
    .filter((file) => file.startsWith(csvPrefix) && file.endsWith(csvSuffix))
    .sort();
  const rows = [];
  for (const file of files) {
    rows.push(...parseCsv(await readFile(path.join(uploadDir, file), "utf8")));
  }
  return rows;
}

async function uploadSwatches(supabase, rows) {
  let uploaded = 0;
  for (const row of rows) {
    const storagePath = storagePathFromUrl(row.swatch_image_url);
    const localPath = path.join(workspace, "downloads", "paint-swatches", storagePath);
    const body = await readFile(localPath);
    const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw new Error(`Storage upload failed for ${storagePath}: ${error.message}`);
    uploaded += 1;
  }
  return uploaded;
}

async function syncCatalog(supabase, rows) {
  const lines = [...new Set(rows.map((row) => row.line))];
  const { data, error } = await supabase
    .from(table)
    .select("id,brand,line,name")
    .eq("brand", "Army Painter")
    .in("line", lines);
  if (error) throw new Error(`Could not load existing catalog rows: ${error.message}`);

  const existingByKey = new Map((data ?? []).map((row) => [`${row.brand}\u0000${row.line}\u0000${row.name}`, row]));
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = existingByKey.get(`${row.brand}\u0000${row.line}\u0000${row.name}`);
    const payload = catalogPayload(row, existing?.id ?? row.id);
    if (existing) {
      const { error: updateError } = await supabase.from(table).update(payload).eq("id", existing.id);
      if (updateError) throw new Error(`Catalog update failed for ${row.line} / ${row.name}: ${updateError.message}`);
      updated += 1;
    } else {
      const { error: insertError } = await supabase.from(table).insert(payload);
      if (insertError) throw new Error(`Catalog insert failed for ${row.line} / ${row.name}: ${insertError.message}`);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

async function verifyPublicUrls(rows) {
  let ok = 0;
  const failures = [];
  for (const row of rows) {
    const response = await fetch(row.swatch_image_url, { method: "HEAD" });
    if (response.ok) {
      ok += 1;
    } else {
      failures.push(`${response.status} ${row.swatch_image_url}`);
    }
  }
  return { ok, failures };
}

async function main() {
  loadDotenvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const rows = await loadRows();
  for (const row of rows) {
    for (const column of columns) {
      if (!row[column] && !["finish", "paint_type"].includes(column)) {
        throw new Error(`Missing ${column} for ${row.line} / ${row.name}`);
      }
    }
  }

  const uploaded = await uploadSwatches(supabase, rows);
  const { inserted, updated } = await syncCatalog(supabase, rows);
  const verified = await verifyPublicUrls(rows);
  if (verified.failures.length > 0) {
    throw new Error(`Public URL verification failed:\n${verified.failures.join("\n")}`);
  }

  console.log(`Rows: ${rows.length}`);
  console.log(`Uploaded PNGs: ${uploaded}`);
  console.log(`Inserted catalog rows: ${inserted}`);
  console.log(`Updated catalog rows: ${updated}`);
  console.log(`Verified public URLs: ${verified.ok}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
