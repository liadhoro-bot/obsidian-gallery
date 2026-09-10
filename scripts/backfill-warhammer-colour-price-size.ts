import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

/**
 * One-time backfill of price_usd and size_ml for the Warhammer Colour line,
 * sourced from a September 2026 crawl of warhammer.com/en-WW/paint.
 *
 * Requires the 20260905120000_add_paint_catalog_price_and_size.sql migration
 * to be applied first (adds paint_catalog.price_usd and paint_catalog.size_ml).
 *
 * Usage:
 *   npx tsx scripts/backfill-warhammer-colour-price-size.ts --dry-run
 *   npx tsx scripts/backfill-warhammer-colour-price-size.ts
 */

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue
    const [, rawKey, rawValue] = match
    const key = rawKey.trim()
    if (process.env[key]) continue
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
  }
}
loadDotEnvLocal()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type SiteItem = { line: string; name: string; price: number | null; size: string | null }

const DRY_RUN = process.argv.includes('--dry-run')

function parseSizeMl(size: string | null): number | null {
  if (!size) return null
  const match = size.match(/([0-9.]+)\s*ML/i)
  return match ? Number(match[1]) : null
}

async function main() {
  const siteItems = JSON.parse(
    readFileSync('scripts/output/warhammer-colour-site-catalogue-2026-09.json', 'utf8')
  ) as SiteItem[]

  const { data: dbRows, error } = await supabase
    .from('paint_catalog')
    .select('id, line, name')
    .eq('brand', 'Warhammer Colour')
  if (error) throw error

  const siteByKey = new Map<string, SiteItem>()
  for (const it of siteItems) siteByKey.set(`${normalize(it.line)}::${normalize(it.name)}`, it)

  const updates: { id: string; price_usd: number | null; size_ml: number | null }[] = []
  const unmatched: { line: string; name: string }[] = []

  for (const row of dbRows ?? []) {
    const key = `${normalize(row.line)}::${normalize(row.name)}`
    const site = siteByKey.get(key)
    if (!site) {
      unmatched.push(row)
      continue
    }
    updates.push({ id: row.id, price_usd: site.price, size_ml: parseSizeMl(site.size) })
  }

  console.log('DB rows:', dbRows?.length ?? 0)
  console.log('Matched for price/size update:', updates.length)
  console.log('Unmatched (left untouched):', unmatched.length, unmatched)

  if (DRY_RUN) {
    console.log('DRY RUN — no DB writes performed.')
    return
  }

  let ok = 0
  let fail = 0
  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('paint_catalog')
      .update({ price_usd: u.price_usd, size_ml: u.size_ml })
      .eq('id', u.id)
    if (updateError) {
      fail++
      console.error('UPDATE FAILED', u.id, updateError.message)
    } else {
      ok++
    }
  }
  console.log(`Done. Updated ${ok} rows, ${fail} failures.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
