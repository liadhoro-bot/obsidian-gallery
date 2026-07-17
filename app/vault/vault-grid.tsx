import { createClient } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import VaultGridClient from './vault-grid-client'
import VaultGridToolbar from './vault-grid-toolbar'
import { captureServerEvent } from '../../utils/analytics/server'
import { findClosestPaints, isUsableColorHex } from '../../utils/color-matching'

type VaultGridProps = {
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  limit: number
  tab: 'find' | 'collection'
  userId: string
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
  color_match_enabled?: boolean | null
  is_owned: boolean
  is_wishlist: boolean
}

type CustomPaintRow = {
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
  limit,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  q: string
  brand: string
  line: string
  limit: number
}) {
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
    .eq('user_id', userId)

  if (q) {
    customQuery = customQuery.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%`)
  }

  if (brand) {
    customQuery = customQuery.eq('manufacturer', brand)
  }

  if (line) {
    customQuery = customQuery.eq('series', line)
  }

  const customResult =
    limit > 0
      ? await customQuery
          .order('manufacturer', { ascending: true })
          .order('series', { ascending: true })
          .order('name', { ascending: true })
          .range(0, limit - 1)
      : await supabase
          .from('paints')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)

  return {
    rows: ((customResult.data ?? []) as CustomPaintRow[]),
    count: customResult.count ?? 0,
  }
}

async function loadCustomPaintImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  customPaintIds: string[]
) {
  const { data } =
    customPaintIds.length > 0
      ? await supabase
          .from('image_assets')
          .select('entity_id, image_url')
          .eq('entity_type', 'paint')
          .eq('user_id', userId)
          .eq('is_featured', true)
          .in('entity_id', customPaintIds)
      : { data: [] }

  return new Map((data ?? []).map((row) => [row.entity_id, row.image_url]))
}

function renderEmptyState(title: string) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-neutral-400">
        Try changing the filters or resetting the search.
      </p>
    </div>
  )
}

function renderGrid({
  tab,
  q,
  brand,
  line,
  ownership,
  matchHex,
  visiblePaints,
  totalCount,
}: {
  tab: 'find' | 'collection'
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  visiblePaints: VaultPaint[]
  totalCount: number
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-black uppercase tracking-[0.22em] text-white/75">
          Showing: {totalCount} colors
        </p>
        <VaultGridToolbar
          tab={tab}
          q={q}
          brand={brand}
          line={line}
          ownership={ownership}
          matchHex={matchHex || undefined}
        />
      </div>

      <VaultGridClient
        initialPaints={visiblePaints}
        tab={tab}
        q={q}
        brand={brand}
        line={line}
        ownership={ownership}
        matchHex={matchHex}
        hasMore={visiblePaints.length < totalCount}
      />
    </div>
  )
}

export default async function VaultGrid({
  q,
  brand,
  line,
  ownership,
  matchHex,
  limit,
  tab,
  userId,
}: VaultGridProps) {
  const perf = createPerfTimer('/vault:grid')
  const supabase = await createClient()
  const from = 0
  const to = limit - 1

  const canUseCollectionShortcut = tab === 'collection' && !q && !brand && !line

  if (canUseCollectionShortcut) {
    const [collectionResult, customResult] = await Promise.all([
      supabase
        .from('user_paint_ownership')
        .select(
          `
          paint_catalog_id,
          is_owned,
          is_wishlist,
          paint:paint_catalog!inner (
            id,
            brand,
            line,
            name,
            sku,
            swatch_image_url,
            hex_approx,
            paint_type
          )
        `,
          { count: 'exact' }
        )
        .eq('user_id', userId)
        .eq('is_owned', true)
        .order('brand', { ascending: true, referencedTable: 'paint' })
        .order('line', { ascending: true, referencedTable: 'paint' })
        .order('name', { ascending: true, referencedTable: 'paint' })
        .range(from, to),
      loadCustomPaints({
        supabase,
        userId,
        q,
        brand,
        line,
        limit,
      }),
    ])
    perf.mark('collection shortcut queries')

    const featuredImageMap = await loadCustomPaintImages(
      supabase,
      userId,
      customResult.rows.map((paint) => paint.id)
    )
    perf.mark('collection shortcut images')

    const catalogPaints = ((collectionResult.data ?? [])
      .map((row) => {
        const paint = Array.isArray(row.paint) ? row.paint[0] : row.paint
        if (!paint) return null

        return {
          id: paint.id,
          source: 'catalog' as const,
          brand: paint.brand,
          line: paint.line,
          name: paint.name,
          sku: paint.sku,
          swatch_image_url: paint.swatch_image_url,
          hex_approx: paint.hex_approx,
          paint_type: paint.paint_type,
          is_owned: row.is_owned === true,
          is_wishlist: row.is_wishlist === true,
        }
      })
      .filter((paint) => paint !== null)) as VaultPaint[]

    const customPaints: VaultPaint[] = customResult.rows.map((paint) => ({
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

    const visiblePaints = [...catalogPaints, ...customPaints].slice(0, limit)
    const totalCount =
      (collectionResult.count ?? catalogPaints.length) +
      (customResult.count ?? customPaints.length)

    if (visiblePaints.length === 0) {
      return renderEmptyState('No paints in your collection yet')
    }

    perf.total()
    return renderGrid({
      tab,
      q,
      brand,
      line,
      ownership,
      matchHex,
      visiblePaints,
      totalCount,
    })
  }

  const needsWishlistSet = tab !== 'collection' || ownership === 'wishlist'
  const ownershipQuery = supabase
    .from('user_paint_ownership')
    .select('paint_catalog_id, is_owned, is_wishlist')
    .eq('user_id', userId)
  const { data: ownershipRows } = needsWishlistSet
    ? await ownershipQuery
    : await ownershipQuery.eq('is_owned', true)
  perf.mark('ownership Supabase query')

  const ownedSet = new Set(
    (ownershipRows ?? [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)
  )
  const wishlistSet = new Set(
    (ownershipRows ?? [])
      .filter((row) => row.is_wishlist)
      .map((row) => row.paint_catalog_id)
  )
  const ownedIds = Array.from(ownedSet)
  const wishlistIds = Array.from(wishlistSet)

  if (tab === 'find' && matchHex) {
    if (!isUsableColorHex(matchHex)) {
      return (
        <div className="rounded-3xl border border-dashed border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-lg font-semibold text-white">Invalid selected color</p>
          <p className="mt-2 text-sm text-red-100/80">
            Open Match a Color and choose a valid swatch.
          </p>
        </div>
      )
    }

    let matchCatalogQuery = supabase
      .from('paint_catalog')
      .select(
        `
        id,
        brand,
        line,
        name,
        sku,
        hex_approx,
        paint_type,
        color_match_enabled
      `
      )
      .eq('is_active', true)
      .eq('color_match_enabled', true)
      .not('hex_approx', 'is', null)
      .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')

    if (brand) {
      matchCatalogQuery = matchCatalogQuery.eq('brand', brand)
    }

    if (line) {
      matchCatalogQuery = matchCatalogQuery.eq('line', line)
    }

    const { data: matchCatalogRows, error: matchCatalogError } =
      await matchCatalogQuery.limit(5000)
    perf.mark('color match Supabase query')

    if (matchCatalogError) {
      return (
        <div className="rounded-3xl border border-dashed border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-lg font-semibold text-white">Color matching failed</p>
          <p className="mt-2 text-sm text-red-100/80">Try again in a moment.</p>
        </div>
      )
    }

    const ownershipFilteredRows = (matchCatalogRows ?? []).filter((paint) => {
      if (ownership === 'owned') return ownedSet.has(paint.id)
      if (ownership === 'unowned') return !ownedSet.has(paint.id)
      if (ownership === 'wishlist') return wishlistSet.has(paint.id)
      if (ownership === 'custom') return false
      return true
    })

    if (!ownershipFilteredRows.length) {
      return (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-semibold text-white">
            No matchable catalog paints found
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            Try changing the filters or clearing ownership filters.
          </p>
        </div>
      )
    }

    const matchedPaintRows = findClosestPaints(matchHex, ownershipFilteredRows, {
      limit: 24,
    }).map(({ paint }) => ({
      id: paint.id,
      source: 'catalog' as const,
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      swatch_image_url: null as string | null,
      hex_approx: paint.hex_approx,
      paint_type: paint.paint_type,
      is_owned: ownedSet.has(paint.id),
      is_wishlist: wishlistSet.has(paint.id),
    }))
    const matchedPaintIds = matchedPaintRows.map((paint) => paint.id)
    const { data: matchedSwatches } = matchedPaintIds.length
      ? await supabase
          .from('paint_catalog')
          .select('id, swatch_image_url')
          .in('id', matchedPaintIds)
      : { data: [] }
    const swatchByPaintId = new Map(
      (matchedSwatches ?? []).map((paint) => [paint.id, paint.swatch_image_url])
    )
    const matchedPaints = matchedPaintRows.map((paint) => ({
      ...paint,
      swatch_image_url: swatchByPaintId.get(paint.id) ?? null,
    }))
    perf.mark('color match logic')

    if (matchedPaints.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-semibold text-white">No results</p>
          <p className="mt-2 text-sm text-neutral-400">
            No eligible paints had a usable swatch color.
          </p>
        </div>
      )
    }

    const closestPaint = matchedPaints[0]
    await captureServerEvent({
      distinctId: userId,
      event: 'paint_color_match_used',
      properties: {
        selected_hex: matchHex.toUpperCase(),
        result_count: matchedPaints.length,
        closest_paint_id: closestPaint?.id ?? null,
        closest_brand: closestPaint?.brand ?? null,
        closest_line: closestPaint?.line ?? null,
        source: 'vault_find_color',
      },
    })

    perf.total()
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-white/75">
              Closest matches to {matchHex.toUpperCase()}
            </p>
            <div className="mt-2 flex min-w-0 items-center gap-2">
              <div
                className="h-7 w-7 shrink-0 rounded-xl border border-white/15"
                style={{ backgroundColor: matchHex }}
                aria-hidden="true"
              />
              <p className="min-w-0 text-xs text-white/40">
                Showing {matchedPaints.length} eligible catalog paints
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
            <VaultGridToolbar
              tab={tab}
              q={q}
              brand={brand}
              line={line}
              ownership={ownership}
              matchHex={matchHex}
            />
          </div>
        </div>

        <VaultGridClient
          initialPaints={matchedPaints}
          tab={tab}
          q={q}
          brand={brand}
          line={line}
          ownership={ownership}
          matchHex={matchHex}
          hasMore={false}
        />
      </div>
    )
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
    catalogQuery =
      ownedIds.length === 0
        ? catalogQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
        : catalogQuery.in('id', ownedIds)
  } else {
    if (ownership === 'owned') {
      catalogQuery =
        ownedIds.length === 0
          ? catalogQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
          : catalogQuery.in('id', ownedIds)
    }

    if (ownership === 'unowned' && ownedIds.length > 0) {
      catalogQuery = catalogQuery.not('id', 'in', `(${ownedIds.join(',')})`)
    }

    if (ownership === 'wishlist') {
      catalogQuery =
        wishlistIds.length === 0
          ? catalogQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
          : catalogQuery.in('id', wishlistIds)
    }

    if (ownership === 'custom') {
      catalogQuery = catalogQuery.in('id', ['00000000-0000-0000-0000-000000000000'])
    }
  }

  const { data: catalogRows, count: catalogCount } = await catalogQuery
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to)
  perf.mark('catalog Supabase query')

  const shouldLoadCustomPaints =
    tab === 'collection' || ownership === 'all' || ownership === 'custom'
  const visibleCatalogCount = catalogRows?.length ?? 0
  const customRowsLimit =
    shouldLoadCustomPaints && visibleCatalogCount < limit
      ? limit - visibleCatalogCount
      : 0

  const customResult = shouldLoadCustomPaints
    ? await loadCustomPaints({
        supabase,
        userId,
        q,
        brand,
        line,
        limit: customRowsLimit,
      })
    : { rows: [] as CustomPaintRow[], count: 0 }
  perf.mark('custom paints Supabase query')

  const featuredImageMap = await loadCustomPaintImages(
    supabase,
    userId,
    customResult.rows.map((paint) => paint.id)
  )
  perf.mark('image/gallery queries')

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
    })) ?? []

  let customPaints: VaultPaint[] = []
  if (tab === 'collection' || ownership === 'all' || ownership === 'custom') {
    customPaints = customResult.rows.map((paint) => ({
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

  const visiblePaints = [...catalogPaints, ...customPaints].slice(0, limit)
  const totalCount =
    tab === 'collection'
      ? (catalogCount ?? 0) + (customResult.count ?? 0)
      : (catalogCount ?? 0) +
        (ownership === 'all' || ownership === 'custom' ? customResult.count ?? 0 : 0)

  if (visiblePaints.length === 0) {
    return renderEmptyState(
      tab === 'collection' ? 'No paints in your collection yet' : 'No paints found'
    )
  }

  perf.total()
  return renderGrid({
    tab,
    q,
    brand,
    line,
    ownership,
    matchHex,
    visiblePaints,
    totalCount,
  })
}
