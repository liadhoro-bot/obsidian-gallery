import * as fs from "node:fs"
import * as path from "node:path"
import * as readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type PaintRow = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  [key: string]: string | null
}

type UrlCheck = {
  ok: boolean
  status: number | null
  method: "HEAD" | "GET"
  error: string | null
}

type AuditResult = {
  paint: PaintRow
  currentUrl: string
  currentCheck: UrlCheck
  suggestedUrl: string | null
  suggestedCheck: UrlCheck | null
  updateStatus: "not-applied" | "updated" | "skipped" | "failed"
  updateError: string | null
}

const TABLE_NAME = "paint_catalog"
const OUTPUT_PATH = path.join(process.cwd(), "scripts", "output", "broken-swatch-report.csv")
const PAGE_SIZE = 1000
const URL_COLUMNS = ["swatch_image_url", "swatch_url", "image_url", "swatchImageUrl"]
const APPLY_FLAG = "--apply"
const YES_FLAG = "--yes"
const HELP_FLAG = "--help"

function getArgValue(name: string) {
  const index = process.argv.indexOf(name)

  if (index === -1) {
    return null
  }

  return process.argv[index + 1] ?? null
}

function getPositiveIntegerArg(name: string) {
  const value = getArgValue(name)

  if (!value) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }

  return parsed
}

function printUsage() {
  console.log(`
Usage:
  npm run audit:paint-swatches
  npm run fix:paint-swatches

Options:
  --apply   Prompt for confirmation, then update broken URLs with verified safe fixes.
  --yes     Skip the interactive APPLY prompt. Intended for supervised automation only.
  --paint-id <id>
           Audit one paint row.
  --limit <n>
           Audit the first n matching rows.
  --help    Show this help text.

Dry run is the default. CSV output is written to scripts/output/broken-swatch-report.csv.
`.trim())
}

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

function formatStatus(check: UrlCheck) {
  return check.error ? `error: ${check.error}` : String(check.status ?? "unknown")
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function checkUrl(url: string): Promise<UrlCheck> {
  try {
    const headResponse = await fetchWithTimeout(url, "HEAD")

    if (headResponse.ok) {
      return {
        ok: true,
        status: headResponse.status,
        method: "HEAD",
        error: null,
      }
    }

    const getResponse = await fetchWithTimeout(url, "GET")

    return {
      ok: getResponse.ok,
      status: getResponse.status,
      method: "GET",
      error: null,
    }
  } catch (error) {
    try {
      const getResponse = await fetchWithTimeout(url, "GET")

      return {
        ok: getResponse.ok,
        status: getResponse.status,
        method: "GET",
        error: null,
      }
    } catch (getError) {
      return {
        ok: false,
        status: null,
        method: "GET",
        error: getErrorMessage(getError),
      }
    }
  }
}

async function detectSwatchUrlColumn(supabase: SupabaseClient) {
  const errors: string[] = []

  for (const column of URL_COLUMNS) {
    const { error } = await supabase.from(TABLE_NAME).select(column).limit(1)

    if (!error) {
      return column
    }

    errors.push(`${column}: ${error.message}`)
  }

  throw new Error(
    [
      `Could not find a swatch URL column on public.${TABLE_NAME}.`,
      `Tried: ${URL_COLUMNS.join(", ")}`,
      `Supabase errors: ${errors.join(" | ")}`,
    ].join(" ")
  )
}

async function getPaintRows(
  supabase: SupabaseClient,
  urlColumn: string,
  options: { paintId: string | null; limit: number | null }
) {
  let from = 0
  const rows: PaintRow[] = []

  while (true) {
    let query = supabase
      .from(TABLE_NAME)
      .select(`id, brand, line, name, ${urlColumn}`)
      .not(urlColumn, "is", null)
      .order("brand", { ascending: true })
      .order("line", { ascending: true })
      .order("name", { ascending: true })

    if (options.paintId) {
      query = query.eq("id", options.paintId)
    }

    if (options.limit) {
      const lastIndex = Math.min(from + PAGE_SIZE - 1, options.limit - 1)
      query = query.range(from, lastIndex)
    } else {
      query = query.range(from, from + PAGE_SIZE - 1)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const page = (data ?? []) as unknown as PaintRow[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE

    if (options.limit && from >= options.limit) {
      break
    }
  }

  return rows.filter((row) => {
    const value = row[urlColumn]
    return typeof value === "string" && value.trim().length > 0
  })
}

function getStorageBucketIndex(url: URL) {
  const parts = url.pathname.split("/")
  const publicIndex = parts.findIndex((part, index) => part === "public" && parts[index - 1] === "object")

  if (publicIndex === -1 || parts[publicIndex + 1] !== "paint-swatches") {
    return -1
  }

  return publicIndex + 1
}

function addCandidate(candidates: string[], currentUrl: string, candidateUrl: URL) {
  const candidate = candidateUrl.toString()

  if (candidate !== currentUrl && !candidates.includes(candidate)) {
    candidates.push(candidate)
  }
}

function buildRepairCandidates(currentUrl: string) {
  const candidates: string[] = []

  try {
    const knownReplacement = currentUrl.replace("/army_painter/", "/army-painter/")

    if (knownReplacement !== currentUrl) {
      candidates.push(knownReplacement)
    }

    const parsed = new URL(currentUrl)
    const parts = parsed.pathname.split("/")
    const bucketIndex = getStorageBucketIndex(parsed)

    if (bucketIndex === -1) {
      return candidates
    }

    const pathStartIndex = bucketIndex + 1
    const pathEndIndex = parts.length - 1

    for (let index = pathStartIndex; index < pathEndIndex; index += 1) {
      if (!parts[index]?.includes("_")) {
        continue
      }

      const candidateParts = [...parts]
      candidateParts[index] = candidateParts[index].replaceAll("_", "-")
      parsed.pathname = candidateParts.join("/")
      addCandidate(candidates, currentUrl, parsed)
    }

    const allFolderParts = [...parts]
    let changed = false

    for (let index = pathStartIndex; index < pathEndIndex; index += 1) {
      if (!allFolderParts[index]?.includes("_")) {
        continue
      }

      allFolderParts[index] = allFolderParts[index].replaceAll("_", "-")
      changed = true
    }

    if (changed) {
      parsed.pathname = allFolderParts.join("/")
      addCandidate(candidates, currentUrl, parsed)
    }

    const extensionMatch = parsed.pathname.match(/\.(png|jpe?g|webp)$/i)

    if (extensionMatch) {
      const duplicateExtensionUrl = new URL(currentUrl)
      duplicateExtensionUrl.pathname = `${duplicateExtensionUrl.pathname}${extensionMatch[0]}`
      addCandidate(candidates, currentUrl, duplicateExtensionUrl)
    }

    const duplicateExtensionMatch = parsed.pathname.match(/(\.(png|jpe?g|webp))\1$/i)

    if (duplicateExtensionMatch) {
      const singleExtensionUrl = new URL(currentUrl)
      singleExtensionUrl.pathname = singleExtensionUrl.pathname.slice(
        0,
        -duplicateExtensionMatch[1].length
      )
      addCandidate(candidates, currentUrl, singleExtensionUrl)
    }
  } catch {
    return candidates
  }

  return candidates
}

async function findWorkingRepair(currentUrl: string) {
  const candidates = buildRepairCandidates(currentUrl)

  for (const candidate of candidates) {
    const check = await checkUrl(candidate)

    if (check.ok) {
      return { url: candidate, check }
    }

    await sleep(100)
  }

  return { url: null, check: null }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
) {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  )

  return results
}

function csvValue(value: string | number | null) {
  const normalized = value === null ? "" : String(value)
  return `"${normalized.replaceAll('"', '""')}"`
}

async function writeCsvReport(results: AuditResult[], urlColumn: string) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })

  const headers = [
    "paint_id",
    "brand",
    "line",
    "name",
    "url_column",
    "current_url",
    "current_http_status",
    "current_check_method",
    "current_error",
    "suggested_url",
    "suggested_http_status",
    "suggested_check_method",
    "update_status",
    "update_error",
  ]

  const rows = results.map((result) => [
    result.paint.id,
    result.paint.brand,
    result.paint.line,
    result.paint.name,
    urlColumn,
    result.currentUrl,
    result.currentCheck.status,
    result.currentCheck.method,
    result.currentCheck.error,
    result.suggestedUrl,
    result.suggestedCheck?.status ?? null,
    result.suggestedCheck?.method ?? null,
    result.updateStatus,
    result.updateError,
  ])

  const csv = [
    headers.map(csvValue).join(","),
    ...rows.map((row) => row.map(csvValue).join(",")),
  ].join("\n")

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      fs.writeFileSync(OUTPUT_PATH, `${csv}\n`, "utf8")
      return OUTPUT_PATH
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EBUSY" &&
        attempt < 5
      ) {
        await sleep(500)
        continue
      }

      const fallbackPath = path.join(
        path.dirname(OUTPUT_PATH),
        `broken-swatch-report-${Date.now()}.csv`
      )

      fs.writeFileSync(fallbackPath, `${csv}\n`, "utf8")
      console.warn(`Could not write ${OUTPUT_PATH}: ${getErrorMessage(error)}`)
      console.warn(`CSV report written to fallback path ${fallbackPath}`)
      return fallbackPath
    }
  }

  return OUTPUT_PATH
}

async function confirmApply(changeCount: number) {
  if (process.argv.includes(YES_FLAG)) {
    return true
  }

  const rl = readline.createInterface({ input, output })

  try {
    const answer = await rl.question(
      `Apply ${changeCount} swatch URL update${changeCount === 1 ? "" : "s"}? Type APPLY to continue: `
    )

    return answer.trim() === "APPLY"
  } finally {
    rl.close()
  }
}

async function applyFixes(supabase: SupabaseClient, results: AuditResult[], urlColumn: string) {
  const candidates = results.filter((result) => result.suggestedUrl)

  for (const result of candidates) {
    if (result.currentCheck.ok) {
      result.updateStatus = "skipped"
      result.updateError = "Current URL is working; refusing to overwrite."
      continue
    }

    const currentRecheck = await checkUrl(result.currentUrl)

    if (currentRecheck.ok) {
      result.currentCheck = currentRecheck
      result.updateStatus = "skipped"
      result.updateError = "Current URL started working on recheck; refusing to overwrite."
      continue
    }

    const suggestedRecheck = await checkUrl(result.suggestedUrl!)

    if (!suggestedRecheck.ok) {
      result.suggestedCheck = suggestedRecheck
      result.updateStatus = "skipped"
      result.updateError = `Suggested URL failed recheck with ${formatStatus(suggestedRecheck)}.`
      continue
    }

    result.suggestedCheck = suggestedRecheck

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ [urlColumn]: result.suggestedUrl })
      .eq("id", result.paint.id)
      .eq(urlColumn, result.currentUrl)
      .select("id")

    if (error) {
      result.updateStatus = "failed"
      result.updateError = error.message
      continue
    }

    if (!data || data.length === 0) {
      result.updateStatus = "skipped"
      result.updateError = "Row changed before update; no update was applied."
      continue
    }

    result.updateStatus = "updated"
    result.updateError = null
    console.log(`Updated ${result.paint.id}: ${result.currentUrl} -> ${result.suggestedUrl}`)
  }
}

async function main() {
  if (process.argv.includes(HELP_FLAG)) {
    printUsage()
    return
  }

  loadDotenvLocal()

  const apply = process.argv.includes(APPLY_FLAG)
  const paintId = getArgValue("--paint-id")
  const limit = getPositiveIntegerArg("--limit")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const urlColumn = await detectSwatchUrlColumn(supabase)
  console.log(`Using public.${TABLE_NAME}.${urlColumn} for swatch URLs.`)

  const rows = await getPaintRows(supabase, urlColumn, { paintId, limit })
  console.log(`Found ${rows.length} paint rows with non-null swatch URLs.`)

  if (paintId && rows.length === 0) {
    console.log(`No paint found for id ${paintId} with a non-null ${urlColumn}.`)
  }

  const results = await mapWithConcurrency(rows, 8, async (paint, index) => {
    const currentUrl = paint[urlColumn]?.trim() ?? ""
    const currentCheck = await checkUrl(currentUrl)
    let suggestedUrl: string | null = null
    let suggestedCheck: UrlCheck | null = null

    if (!currentCheck.ok) {
      const repair = await findWorkingRepair(currentUrl)
      suggestedUrl = repair.url
      suggestedCheck = repair.check

      console.log(
        [
          `[${index + 1}/${rows.length}] Broken`,
          paint.id,
          [paint.brand, paint.line, paint.name].filter(Boolean).join(" / "),
          formatStatus(currentCheck),
          suggestedUrl ? `fix: ${suggestedUrl}` : "no safe fix",
        ].join(" | ")
      )
    }

    return {
      paint,
      currentUrl,
      currentCheck,
      suggestedUrl,
      suggestedCheck,
      updateStatus: "not-applied",
      updateError: null,
    } satisfies AuditResult
  })

  const broken = results.filter((result) => !result.currentCheck.ok)
  const repairable = broken.filter((result) => result.suggestedUrl)

  console.log("")
  console.log("Dry-run summary:")
  console.log(`Checked: ${results.length}`)
  console.log(`Working: ${results.length - broken.length}`)
  console.log(`Broken/error: ${broken.length}`)
  console.log(`Repairable: ${repairable.length}`)
  console.log(`Will update now: ${apply ? "only after confirmation" : "no; dry run only"}`)

  if (repairable.length > 0) {
    console.log("")
    console.log("Proposed updates:")

    for (const result of repairable) {
      console.log(
        [
          result.paint.id,
          [result.paint.brand, result.paint.line, result.paint.name].filter(Boolean).join(" / "),
          `${result.currentUrl} -> ${result.suggestedUrl}`,
        ].join(" | ")
      )
    }
  }

  if (apply && repairable.length > 0) {
    const confirmed = await confirmApply(repairable.length)

    if (confirmed) {
      await applyFixes(supabase, results, urlColumn)
    } else {
      console.log("Confirmation declined. No updates were applied.")
    }
  }

  const reportPath = await writeCsvReport(results, urlColumn)
  console.log(`CSV report written to ${reportPath}`)
}

main().catch((error: unknown) => {
  console.error(`Paint swatch audit failed: ${getErrorMessage(error)}`)
  process.exitCode = 1
})
