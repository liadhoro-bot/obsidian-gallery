import * as fs from "node:fs"
import * as path from "node:path"
import { createClient } from "@supabase/supabase-js"

type CsvRow = Record<string, string>

type CuratorTemplate = {
  key: string
  surface: string | null
  category: string | null
  variant: string | null
  title: string | null
  body_lines: string[]
  question: string | null
  primary_cta_label: string | null
  primary_cta_href: string | null
  secondary_cta_label: string | null
  image_url: string | null
  weight: number | null
  is_active: boolean | null
  body: string | null
  tone: string | null
  updated_at: string | null
}

const CSV_FILE_NAME = "curator_message_templates.csv"

function loadDotenvLocal() {
  const envPath = path.join(process.cwd(), ".env.local")

  if (!fs.existsSync(envPath)) {
    return
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()

    if (process.env[key]) {
      continue
    }

    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (char === "," && !inQuotes) {
      row.push(field)
      field = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1
      }

      row.push(field)

      if (row.some((value) => value.length > 0)) {
        rows.push(row)
      }

      row = []
      field = ""
      continue
    }

    field += char
  }

  row.push(field)

  if (row.some((value) => value.length > 0)) {
    rows.push(row)
  }

  const [headers, ...dataRows] = rows

  if (!headers) {
    return []
  }

  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""]))
  )
}

function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return parsed
}

function parseBoolean(value: string): boolean | null {
  if (value.trim() === "") {
    return null
  }

  if (/^true$/i.test(value)) {
    return true
  }

  if (/^false$/i.test(value)) {
    return false
  }

  throw new Error(`Invalid boolean: ${value}`)
}

function parseBodyLines(value: string, key: string): string[] {
  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed) || parsed.some((line) => typeof line !== "string")) {
      throw new Error("body_lines must be a JSON array of strings")
    }

    return parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(`Invalid body_lines for ${key}: ${message}`)
  }
}

function mapTemplate(row: CsvRow): CuratorTemplate {
  if (!row.key) {
    throw new Error("CSV row is missing key")
  }

  return {
    key: row.key,
    surface: emptyToNull(row.surface),
    category: emptyToNull(row.category),
    variant: emptyToNull(row.variant),
    title: emptyToNull(row.title),
    body_lines: parseBodyLines(row.body_lines, row.key),
    question: emptyToNull(row.question),
    primary_cta_label: emptyToNull(row.primary_cta_label),
    primary_cta_href: emptyToNull(row.primary_cta_href),
    secondary_cta_label: emptyToNull(row.secondary_cta_label),
    image_url: emptyToNull(row.image_url),
    weight: parseNumber(row.weight),
    is_active: parseBoolean(row.is_active),
    body: emptyToNull(row.body),
    tone: emptyToNull(row.tone),
    updated_at: emptyToNull(row.updated_at),
  }
}

async function main() {
  loadDotenvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  const csvPath =
    process.argv[2] ??
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", "Downloads", CSV_FILE_NAME)

  const csvContent = fs.readFileSync(csvPath, "utf8")
  const templates = parseCsv(csvContent).map(mapTemplate)

  if (templates.length === 0) {
    console.log("No curator templates found in CSV.")
    return
  }

  const uniqueKeys = new Set(templates.map((template) => template.key))

  if (uniqueKeys.size !== templates.length) {
    throw new Error("CSV contains duplicate key values. Aborting before upsert.")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { error } = await supabase
    .from("curator_message_templates")
    .upsert(templates, {
      onConflict: "key",
    })

  if (error) {
    throw error
  }

  console.log(`Upserted ${templates.length} curator message templates.`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)

  console.error(`Import failed: ${message}`)
  process.exitCode = 1
})
