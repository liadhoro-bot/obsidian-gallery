import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'
import {
  applyCatalogVaultFilters,
  loadCatalogOwnershipState,
  normalizeVaultBatchFilters,
} from '../../vault/vault-query'

type CustomPaint = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  paint_type: string | null
  color_hex: string | null
}

async function loadCustomPaints({
  supabase,
  userId,
  q,
  brand,
  line,
  to,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  q: string
  brand: string
  line: string
  to: number
}) {
  let customQuery = supabase
    .from('paints')
    .select('id, name, manufacturer, series, paint_type, color_hex')
    .eq('user_id', userId)

  if (q) {
    customQuery = customQuery.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
  }

  if (brand) customQuery = customQuery.eq('manufacturer', brand)
  if (line) customQuery = customQuery.eq('series', line)

  const { data: customRows } = await customQuery
    .order('manufacturer', { ascending: true })
    .order('series', { ascending: true })
    .order('name', { ascending: true })
    .range(0, to + 1)

  const rows = (customRows ?? []) as CustomPaint[]
  const customPaintIds = rows.map((paint) => paint.id)
  const { data: customImageRows } =
    customPaintIds.length > 0
      ? await supabase
          .from('image_assets')
          .select('entity_id, image_url')
          .eq('entity_type', 'paint')
          .eq('user_id', userId)
          .eq('is_featured', true)
          .in('entity_id', customPaintIds)
      : { data: [] }

  const featuredImageMap = new Map(
    (customImageRows ?? []).map((row) => [row.entity_id, row.image_url])
  )

  return rows.map((paint) => ({
    id: paint.id,
    source: 'custom',
    brand: paint.manufacturer,
    line: paint.series,
    name: paint.name,
    sku: null,
    swatch_image_url: featuredImageMap.get(paint.id) ?? null,
    hex_approx: paint.color_hex,
    paint_type: paint.paint_type,
    is_owned: true,
    is_wishlist: false,
  }))
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const filters = normalizeVaultBatchFilters({
    q: searchParams.get('q') || '',
    brand: searchParams.get('brand') || '',
    line: searchParams.get('line') || '',
    ownership: searchParams.get('ownership') || 'all',
    matchHex: searchParams.get('matchHex') || '',
    tab: searchParams.get('tab') === 'collection' ? 'collection' : 'find',
  })
  const from = Number(searchParams.get('from') || 0)
  const to = Number(searchParams.get('to') || 23)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ paints: [], hasMore: false })
  }

  const ownershipState = await loadCatalogOwnershipState(supabase, user.id)
  let query = supabase
    .from('paint_catalog')
    .select(
      `
      id,
      brand,
      line,
      name,
      sku,
      swatch_image_url,
      hex_approx,
      paint_type
    `
    )
    .eq('is_active', true)

  query = applyCatalogVaultFilters(query, filters, ownershipState)

  const { data } = await query
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(0, to + 1)

  const catalogPaints = (data ?? []).map((paint) => ({
    id: paint.id,
    source: 'catalog',
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    sku: paint.sku,
    swatch_image_url: paint.swatch_image_url,
    hex_approx: paint.hex_approx,
    paint_type: paint.paint_type,
    is_owned: ownershipState.ownedSet.has(paint.id),
    is_wishlist: ownershipState.wishlistSet.has(paint.id),
  }))

  const shouldLoadCustomPaints =
    filters.tab === 'collection' ||
    filters.ownership === 'all' ||
    filters.ownership === 'custom'
  const customPaints = shouldLoadCustomPaints
    ? await loadCustomPaints({
        supabase,
        userId: user.id,
        q: filters.q,
        brand: filters.brand,
        line: filters.line,
        to,
      })
    : []

  const rows = [...catalogPaints, ...customPaints]
  const paints = rows.slice(from, to + 1)
  const hasMore = rows.length > to + 1

  return NextResponse.json({ paints, hasMore })
}
