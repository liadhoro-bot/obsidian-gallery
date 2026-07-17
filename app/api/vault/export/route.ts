import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { captureServerEvent } from '../../../../utils/analytics/server'
import {
  findClosestPaints,
  isUsableColorHex,
} from '../../../../utils/color-matching'

type VaultTab = 'find' | 'collection'
type ExportFormat = 'csv' | 'txt' | 'json' | 'pdf'
type AnalyticsExportFormat = 'csv' | 'text' | 'json' | 'pdf'

type ExportRow = {
  brand: string
  line: string
  name: string
  status: 'Owned' | 'Wishlist' | 'Unowned' | 'Custom'
  quantity: number
  barcode: string
  hex: string
  sku: string
  product_code: string
}

type OwnershipRow = {
  paint_catalog_id: string
  is_owned: boolean | null
  is_wishlist: boolean | null
  units_owned: number | null
}

type CatalogPaintRow = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  barcode_primary: string | null
  hex_approx: string | null
  paint_type?: string | null
  color_match_enabled?: boolean | null
}

type CustomPaintRow = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  color_hex: string | null
}

type RequestBody = {
  format?: string
  tab?: string
  q?: string
  brand?: string
  line?: string
  ownership?: string
  matchHex?: string
}

const PAGE_SIZE = 1000
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'

function cleanFormat(format?: string): ExportFormat {
  if (format === 'txt' || format === 'json' || format === 'pdf') return format
  return 'csv'
}

function getAnalyticsFormat(format: ExportFormat): AnalyticsExportFormat {
  return format === 'txt' ? 'text' : format
}

function cleanTab(tab?: string): VaultTab {
  return tab === 'collection' ? 'collection' : 'find'
}

function cleanText(value?: string) {
  return String(value || '').trim()
}

function getStatus(ownership?: OwnershipRow) {
  if (ownership?.is_owned) return 'Owned'
  if (ownership?.is_wishlist) return 'Wishlist'
  return 'Unowned'
}

function slugPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildFilename({
  format,
  tab,
  q,
  brand,
  line,
  ownership,
  matchHex,
}: {
  format: ExportFormat
  tab: VaultTab
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
}) {
  const parts = ['obsidian-gallery']

  if (matchHex) {
    parts.push('color-match', slugPart(matchHex))
  } else if (tab === 'collection') {
    parts.push('my-paints')
  } else if (ownership === 'wishlist') {
    parts.push('wishlist')
  } else if (ownership === 'custom') {
    parts.push('custom-colors')
  } else if (brand || line) {
    parts.push(brand ? slugPart(brand) : 'paints')
    if (line) parts.push(slugPart(line))
  } else if (q) {
    parts.push('search', slugPart(q).slice(0, 40))
  } else {
    parts.push('paints-all-colors')
  }

  return `${parts.filter(Boolean).join('-')}.${format}`
}

function toExportRows(
  catalogRows: CatalogPaintRow[],
  ownershipByPaintId: Map<string, OwnershipRow>
): ExportRow[] {
  return catalogRows.map((paint) => {
    const ownership = ownershipByPaintId.get(paint.id)

    return {
      brand: paint.brand || '',
      line: paint.line || '',
      name: paint.name || '',
      status: getStatus(ownership),
      quantity: ownership?.units_owned || 0,
      barcode: paint.barcode_primary || '',
      hex: paint.hex_approx || '',
      sku: paint.sku || '',
      product_code: paint.sku || '',
    }
  })
}

function buildCatalogSearchFilter(q: string) {
  const numericQ = q.replace(/\D/g, '')
  const searchParts = [
    `name.ilike.%${q}%`,
    `sku.ilike.%${q}%`,
    `brand.ilike.%${q}%`,
    `line.ilike.%${q}%`,
    `hex_approx.ilike.%${q}%`,
  ]

  if (numericQ.length >= 8) {
    searchParts.push(`barcode_primary.eq.${numericQ}`)
    searchParts.push(`barcode_aliases.cs.{${numericQ}}`)
  }

  return searchParts.join(',')
}

async function fetchAllCatalogRows({
  supabase,
  q,
  brand,
  line,
  tab,
  ownership,
  ownedIds,
  wishlistIds,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  q: string
  brand: string
  line: string
  tab: VaultTab
  ownership: string
  ownedIds: string[]
  wishlistIds: string[]
}) {
  const rows: CatalogPaintRow[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('paint_catalog')
      .select(
        `
          id,
          brand,
          line,
          name,
          sku,
          barcode_primary,
          hex_approx
        `
      )
      .eq('is_active', true)

    if (q) query = query.or(buildCatalogSearchFilter(q))

    if (brand) query = query.eq('brand', brand)
    if (line) query = query.eq('line', line)

    if (tab === 'collection' || ownership === 'owned') {
      query = query.in('id', ownedIds.length ? ownedIds : [EMPTY_UUID])
    } else if (ownership === 'wishlist') {
      query = query.in('id', wishlistIds.length ? wishlistIds : [EMPTY_UUID])
    } else if (ownership === 'custom') {
      query = query.in('id', [EMPTY_UUID])
    } else if (ownership === 'unowned' && ownedIds.length > 0) {
      query = query.not('id', 'in', `(${ownedIds.join(',')})`)
    }

    const { data, error } = await query
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    rows.push(...((data || []) as CatalogPaintRow[]))

    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function fetchMatchedCatalogRows({
  supabase,
  matchHex,
  brand,
  line,
  ownership,
  ownedIds,
  wishlistIds,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  matchHex: string
  brand: string
  line: string
  ownership: string
  ownedIds: string[]
  wishlistIds: string[]
}) {
  let query = supabase
    .from('paint_catalog')
    .select(
      `
        id,
        brand,
        line,
        name,
        sku,
        barcode_primary,
        hex_approx,
        paint_type,
        color_match_enabled
      `
    )
    .eq('is_active', true)
    .eq('color_match_enabled', true)
    .not('hex_approx', 'is', null)
    .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')

  if (brand) query = query.eq('brand', brand)
  if (line) query = query.eq('line', line)

  const { data, error } = await query.limit(5000)

  if (error) throw new Error(error.message)

  const filteredRows = ((data || []) as CatalogPaintRow[]).filter((paint) => {
    if (ownership === 'owned') return ownedIds.includes(paint.id)
    if (ownership === 'unowned') return !ownedIds.includes(paint.id)
    if (ownership === 'wishlist') return wishlistIds.includes(paint.id)
    if (ownership === 'custom') return false
    return true
  })

  return findClosestPaints(matchHex, filteredRows, { limit: 24 }).map(
    ({ paint }) => paint
  )
}

async function fetchAllCustomRows({
  supabase,
  userId,
  q,
  brand,
  line,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  q: string
  brand: string
  line: string
}) {
  const rows: CustomPaintRow[] = []
  let from = 0

  while (true) {
    let query = supabase
      .from('paints')
      .select('id, name, manufacturer, series, color_hex')
      .eq('user_id', userId)

    if (q) query = query.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
    if (brand) query = query.eq('manufacturer', brand)
    if (line) query = query.eq('series', line)

    const { data, error } = await query
      .order('manufacturer', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)

    rows.push(...((data || []) as CustomPaintRow[]))

    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody
  const format = cleanFormat(body.format)
  const tab = cleanTab(body.tab)
  const q = cleanText(body.q)
  const brand = cleanText(body.brand)
  const line = cleanText(body.line)
  const ownership = tab === 'collection' ? 'owned' : cleanText(body.ownership) || 'all'
  const matchHex =
    tab === 'find' && isUsableColorHex(cleanText(body.matchHex))
      ? cleanText(body.matchHex).toUpperCase()
      : ''

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { data: ownershipRows, error: ownershipError } = await supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id, is_owned, is_wishlist, units_owned')
      .eq('user_id', user.id)

    if (ownershipError) throw new Error(ownershipError.message)

    const ownershipByPaintId = new Map(
      ((ownershipRows || []) as OwnershipRow[]).map((row) => [
        row.paint_catalog_id,
        row,
      ])
    )

    const ownedIds = Array.from(ownershipByPaintId.values())
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)

    const wishlistIds = Array.from(ownershipByPaintId.values())
      .filter((row) => row.is_wishlist)
      .map((row) => row.paint_catalog_id)

    const catalogRows = matchHex
      ? await fetchMatchedCatalogRows({
          supabase,
          matchHex,
          brand,
          line,
          ownership,
          ownedIds,
          wishlistIds,
        })
      : await fetchAllCatalogRows({
          supabase,
          q,
          brand,
          line,
          tab,
          ownership,
          ownedIds,
          wishlistIds,
        })

    const includeCustom =
      !matchHex &&
      (tab === 'collection' || ownership === 'all' || ownership === 'custom')
    const customRows = includeCustom
      ? await fetchAllCustomRows({
          supabase,
          userId: user.id,
          q,
          brand,
          line,
        })
      : []

    const catalogExportRows = toExportRows(catalogRows, ownershipByPaintId)

    const customExportRows: ExportRow[] = customRows.map((paint) => ({
      brand: paint.manufacturer || '',
      line: paint.series || '',
      name: paint.name || '',
      status: 'Custom',
      quantity: 1,
      barcode: '',
      hex: paint.color_hex || '',
      sku: '',
      product_code: '',
    }))

    const rows = [...catalogExportRows, ...customExportRows]
    const filename = buildFilename({
      format,
      tab,
      q,
      brand,
      line,
      ownership,
      matchHex,
    })

    await captureServerEvent({
      distinctId: user.id,
      event: 'vault_list_exported',
      properties: {
        format: getAnalyticsFormat(format),
        tab,
        brand: brand || null,
        line: line || null,
        ownership,
        color_match_hex: matchHex || null,
        search_present: Boolean(q),
        exported_count: rows.length,
      },
    })

    return NextResponse.json({
      rows,
      filename,
      exported_count: rows.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not export paints list',
      },
      { status: 500 }
    )
  }
}
