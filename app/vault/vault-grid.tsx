  import { createClient } from '../../utils/supabase/server'
  import VaultGridClient from './vault-grid-client'
  import VaultExportButton from './vault-export-button'

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
    paint_type,
    barcode_primary,
    barcode_aliases
  `,
  { count: 'exact' }
)
      .eq('is_active', true)

    if (q) {
  const cleanedQ = q.trim()
  const numericQ = cleanedQ.replace(/\D/g, '')

  const searchParts = [
    `name.ilike.%${cleanedQ}%`,
    `sku.ilike.%${cleanedQ}%`,
    `brand.ilike.%${cleanedQ}%`,
    `line.ilike.%${cleanedQ}%`,
    `hex_approx.ilike.%${cleanedQ}%`,
  ]

  if (numericQ.length >= 8) {
    searchParts.push(`barcode_primary.eq.${numericQ}`)
    searchParts.push(`barcode_aliases.cs.{${numericQ}}`)
  }

  catalogQuery = catalogQuery.or(searchParts.join(','))
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

  if (ownership === 'custom') {
    catalogQuery = catalogQuery.in('id', [
      '00000000-0000-0000-0000-000000000000',
    ])
  }
  }

    const { data: catalogRows, count: catalogCount } = await catalogQuery
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to)

    let customQuery = supabase
      .from('paints')
      .select(
        `
        id,
        name,
        manufacturer,
        series,
        paint_type,
        color_hex
      `,
        { count: 'exact' }
      )
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

    const { data: customRows, count: customCount } = await customQuery
      .order('manufacturer', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })
      .range(0, 999)
  const customPaintIds =
    customRows?.map((paint) => paint.id) || []

  const { data: customImageRows } =
    customPaintIds.length > 0
      ? await supabase
          .from('image_assets')
          .select('entity_id, image_url')
          .eq('entity_type', 'paint')
          .eq('user_id', user.id)
          .eq('is_featured', true)
          .in('entity_id', customPaintIds)
      : { data: [] }

  const featuredImageMap = new Map(
    (customImageRows || []).map((row) => [
      row.entity_id,
      row.image_url,
    ])
  )
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
        swatch_image_url:
    featuredImageMap.get(paint.id) || null,
        hex_approx: paint.color_hex,
        paint_type: paint.paint_type,
        is_owned: true,
        is_wishlist: false,
      })) || []
  } else {
    // Find Color behavior (optional inclusion)
    if (ownership === 'all' || ownership === 'custom') {
      customPaints =
        customRows?.map((paint) => ({
          id: paint.id,
          source: 'custom',
          brand: paint.manufacturer,
          line: paint.series,
          name: paint.name,
          sku: null,
          swatch_image_url:
    featuredImageMap.get(paint.id) || null,
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
      ? (catalogCount || 0) + (customCount || 0)
      : (catalogCount || 0) +
        (ownership === 'all' || ownership === 'custom'
          ? customCount || 0
          : 0)

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
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-black uppercase tracking-[0.22em] text-white/75">
          Showing: {totalCount} colors
        </p>
        <VaultExportButton
          tab={tab}
          q={q}
          brand={brand}
          line={line}
          ownership={ownership}
        />
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

