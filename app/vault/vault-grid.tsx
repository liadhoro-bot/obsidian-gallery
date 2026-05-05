import { createClient } from '../../utils/supabase/server'
import VaultGridClient from './vault-grid-client'

type VaultGridProps = {
  q: string
  brand: string
  line: string
  ownership: string
  limit: number
  tab: 'find' | 'collection'
}

type VaultPaint = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  paint_type: string | null
  is_owned: boolean
  is_wishlist: boolean
}

const PAGE_SIZE = 24

function getBrandAbbreviation(brand?: string | null) {
  const normalized = (brand || '').toLowerCase()

  if (normalized.includes('vallejo')) return 'VAL'
  if (normalized.includes('warhammer')) return 'WHC'
  if (normalized.includes('citadel')) return 'WHC'
  if (normalized.includes('army painter')) return 'TAP'
  if (normalized.includes('custom')) return 'CUS'

  return (brand || 'UNK').slice(0, 3).toUpperCase()
}

function buildLimitHref({
  q,
  brand,
  line,
  ownership,
  limit,
}: {
  q: string
  brand: string
  line: string
  ownership: string
  limit: number
}) {
  const params = new URLSearchParams()

  if (q) params.set('q', q)
  if (brand) params.set('brand', brand)
  if (line) params.set('line', line)
  if (ownership) params.set('ownership', ownership)
  if (limit > PAGE_SIZE) params.set('limit', String(limit))

  const query = params.toString()
  return query ? `/vault?${query}` : '/vault'
}

export default async function VaultGrid({
  q,
  brand,
  line,
  ownership,
  limit,
  tab,
}: VaultGridProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const from = 0
  const to = limit - 1

  const { data: ownershipRows } = await supabase
    .from('user_paint_ownership')
    .select('paint_catalog_id, is_owned, is_wishlist')
    .eq('user_id', user.id)

  const ownedSet = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)
  )

  const wishlistSet = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_wishlist)
      .map((row) => row.paint_catalog_id)
  )

  const ownedIds = Array.from(ownedSet)
// ---------- COLLECTION COUNTS ----------
let ownedCatalogCount = 0
let customCount = 0

if (tab === 'collection') {
  if (ownedIds.length > 0) {
    const { count } = await supabase
      .from('paint_catalog')
      .select('id', { count: 'exact', head: true })
      .in('id', ownedIds)

    ownedCatalogCount = count || 0
  }

  const { count } = await supabase
    .from('paints')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  customCount = count || 0
}
  let catalogQuery = supabase
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
      `,
      { count: 'exact' }
    )
    .eq('is_active', true)

  if (q) {
    catalogQuery = catalogQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
  }

  if (brand) {
    catalogQuery = catalogQuery.eq('brand', brand)
  }

  if (line) {
    catalogQuery = catalogQuery.eq('line', line)
  }

  if (tab === 'collection') {
  // ONLY owned catalog paints
  if (ownedIds.length === 0) {
    catalogQuery = catalogQuery.in('id', [
      '00000000-0000-0000-0000-000000000000',
    ])
  } else {
    catalogQuery = catalogQuery.in('id', ownedIds)
  }
} else {
  // Normal Find Color behavior
  if (ownership === 'owned') {
    if (ownedIds.length === 0) {
      catalogQuery = catalogQuery.in('id', [
        '00000000-0000-0000-0000-000000000000',
      ])
    } else {
      catalogQuery = catalogQuery.in('id', ownedIds)
    }
  }

  if (ownership === 'unowned' && ownedIds.length > 0) {
  catalogQuery = catalogQuery.not('id', 'in', `(${ownedIds.join(',')})`)
}

if (ownership === 'wishlist') {
  const wishlistIds = Array.from(wishlistSet)

  if (wishlistIds.length === 0) {
    catalogQuery = catalogQuery.in('id', [
      '00000000-0000-0000-0000-000000000000',
    ])
  } else {
    catalogQuery = catalogQuery.in('id', wishlistIds)
  }
}
}

  const { data: catalogRows, count: catalogCount } = await catalogQuery
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to)

  let customQuery = supabase
    .from('paints')
    .select(`
      id,
      name,
      manufacturer,
      series,
      paint_type,
      color_hex
    `)
    .eq('user_id', user.id)

  if (q) {
    customQuery = customQuery.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
  }

  if (brand) {
    customQuery = customQuery.eq('manufacturer', brand)
  }

  if (line) {
    customQuery = customQuery.eq('series', line)
  }

  const { data: customRows } = await customQuery
    .order('manufacturer', { ascending: true })
    .order('series', { ascending: true })
    .order('name', { ascending: true })
    .range(0, 999)

  const catalogPaints: VaultPaint[] =
    catalogRows?.map((paint) => ({
      id: paint.id,
      source: 'catalog',
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      swatch_image_url: paint.swatch_image_url,
      hex_approx: paint.hex_approx,
      paint_type: paint.paint_type,
      is_owned: ownedSet.has(paint.id),
      is_wishlist: wishlistSet.has(paint.id),
    })) || []

  let customPaints: VaultPaint[] = []

if (tab === 'collection') {
  // ALWAYS show custom paints in My Collection
  customPaints =
    customRows?.map((paint) => ({
      id: paint.id,
      source: 'custom',
      brand: paint.manufacturer,
      line: paint.series,
      name: paint.name,
      sku: null,
      swatch_image_url: null,
      hex_approx: paint.color_hex,
      paint_type: paint.paint_type,
      is_owned: true,
      is_wishlist: false,
    })) || []
} else {
  // Find Color behavior (optional inclusion)
  if (ownership !== 'unowned') {
    customPaints =
      customRows?.map((paint) => ({
        id: paint.id,
        source: 'custom',
        brand: paint.manufacturer,
        line: paint.series,
        name: paint.name,
        sku: null,
        swatch_image_url: null,
        hex_approx: paint.color_hex,
        paint_type: paint.paint_type,
        is_owned: true,
        is_wishlist: false,
      })) || []
  }
}

  const visiblePaints = [...catalogPaints, ...customPaints].slice(0, limit)

  const totalCount =
  tab === 'collection'
    ? ownedCatalogCount + customCount
    : catalogCount || 0

const hasNextPage = limit < totalCount

  if (visiblePaints.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="text-lg font-semibold text-white">
  {tab === 'collection'
    ? 'No paints in your collection yet'
    : 'No paints found'}
</p>
        <p className="mt-2 text-sm text-neutral-400">
          Try changing the filters or resetting the search.
        </p>
      </div>
    )
  }

  return (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-white/75">
        Showing: {totalCount} colors
      </p>
    </div>

    <VaultGridClient
      initialPaints={visiblePaints}
      q={q}
      brand={brand}
      line={line}
      ownership={ownership}
    />
  </div>
)
}

