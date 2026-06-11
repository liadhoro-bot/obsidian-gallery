import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

type CatalogFilterRow = {
  brand: string | null
  line: string | null
}

type CustomFilterRow = {
  manufacturer: string | null
  series: string | null
}

const EMPTY_ID = '00000000-0000-0000-0000-000000000000'

function uniqueSorted(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  )
}

function escapeFilterValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q')?.trim() || ''
  const brand = searchParams.get('brand')?.trim() || ''
  const line = searchParams.get('line')?.trim() || ''
  const ownership = searchParams.get('ownership') || 'all'
  const limit = Math.min(Number(searchParams.get('limit') || 80), 120)
  const includeFilters = searchParams.get('includeFilters') === 'true'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: ownershipRows } = user
    ? await supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id, is_owned, is_wishlist')
        .eq('user_id', user.id)
    : { data: [] }

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
  const wishlistIds = Array.from(wishlistSet)
  const escapedQuery = escapeFilterValue(q)
  const pageSize = 1000

  async function getCatalogFilterRows(filterBrand = '') {
    if (ownership === 'owned' && ownedIds.length === 0) return []
    if (ownership === 'wishlist' && wishlistIds.length === 0) return []

    let from = 0
    let allRows: CatalogFilterRow[] = []

    while (true) {
      let filterQuery = supabase
        .from('paint_catalog')
        .select('brand,line')
        .eq('is_active', true)

      if (q) {
        filterQuery = filterQuery.or(
          `name.ilike.%${escapedQuery}%,brand.ilike.%${escapedQuery}%,line.ilike.%${escapedQuery}%,sku.ilike.%${escapedQuery}%`
        )
      }

      if (filterBrand) {
        filterQuery = filterQuery.eq('brand', filterBrand)
      }

      if (ownership === 'owned') {
        filterQuery = filterQuery.in('id', ownedIds)
      }

      if (ownership === 'wishlist') {
        filterQuery = filterQuery.in('id', wishlistIds)
      }

      if (ownership === 'unowned' && ownedIds.length > 0) {
        filterQuery = filterQuery.not('id', 'in', `(${ownedIds.join(',')})`)
      }

      const { data, error: filterError } = await filterQuery
        .order('brand', { ascending: true })
        .order('line', { ascending: true })
        .range(from, from + pageSize - 1)

      if (filterError) {
        throw new Error(filterError.message)
      }

      const rows = (data || []) as CatalogFilterRow[]
      allRows = [...allRows, ...rows]

      if (rows.length < pageSize) break

      from += pageSize
    }

    return allRows
  }

  async function getCustomFilterRows(filterBrand = '') {
    if (!user || (ownership !== 'all' && ownership !== 'owned')) return []

    let filterQuery = supabase
      .from('paints')
      .select('manufacturer,series')
      .eq('user_id', user.id)

    if (q) {
      filterQuery = filterQuery.or(
        `name.ilike.%${escapedQuery}%,manufacturer.ilike.%${escapedQuery}%,series.ilike.%${escapedQuery}%`
      )
    }

    if (filterBrand) {
      filterQuery = filterQuery.eq('manufacturer', filterBrand)
    }

    const { data, error: customFilterError } = await filterQuery
      .order('manufacturer', { ascending: true })
      .order('series', { ascending: true })

    if (customFilterError) {
      throw new Error(customFilterError.message)
    }

    return (data || []) as CustomFilterRow[]
  }

  let catalogQuery = supabase
    .from('paint_catalog')
    .select('id, name, brand, line, sku, swatch_image_url, hex_approx')
    .eq('is_active', true)

  if (q) {
    catalogQuery = catalogQuery.or(
      `name.ilike.%${escapedQuery}%,brand.ilike.%${escapedQuery}%,line.ilike.%${escapedQuery}%,sku.ilike.%${escapedQuery}%`
    )
  }

  if (brand) {
    catalogQuery = catalogQuery.eq('brand', brand)
  }

  if (line) {
    catalogQuery = catalogQuery.eq('line', line)
  }

  if (ownership === 'owned') {
    catalogQuery = catalogQuery.in('id', ownedIds.length > 0 ? ownedIds : [EMPTY_ID])
  }

  if (ownership === 'wishlist') {
    catalogQuery = catalogQuery.in(
      'id',
      wishlistIds.length > 0 ? wishlistIds : [EMPTY_ID]
    )
  }

  if (ownership === 'unowned' && ownedIds.length > 0) {
    catalogQuery = catalogQuery.not('id', 'in', `(${ownedIds.join(',')})`)
  }

  const { data: catalogPaints, error } = await catalogQuery
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let customPaints: {
    id: string
    source: 'custom'
    name: string
    brand: string | null
    line: string | null
    sku: null
    swatch_image_url: null
    hex: string | null
    hex_approx: string | null
    is_owned: boolean
    is_wishlist: boolean
  }[] = []

  if (user && (ownership === 'all' || ownership === 'owned')) {
    let customQuery = supabase
      .from('paints')
      .select('id, name, manufacturer, series, color_hex')
      .eq('user_id', user.id)

    if (q) {
      customQuery = customQuery.or(
        `name.ilike.%${escapedQuery}%,manufacturer.ilike.%${escapedQuery}%,series.ilike.%${escapedQuery}%`
      )
    }

    if (brand) {
      customQuery = customQuery.eq('manufacturer', brand)
    }

    if (line) {
      customQuery = customQuery.eq('series', line)
    }

    const { data: customRows, error: customError } = await customQuery
      .order('manufacturer', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit)

    if (customError) {
      return NextResponse.json({ error: customError.message }, { status: 500 })
    }

    customPaints =
      customRows?.map((paint) => ({
        id: paint.id,
        source: 'custom' as const,
        name: paint.name || 'Unnamed paint',
        brand: paint.manufacturer,
        line: paint.series,
        sku: null,
        swatch_image_url: null,
        hex: paint.color_hex,
        hex_approx: paint.color_hex,
        is_owned: true,
        is_wishlist: false,
      })) || []
  }

  const paints = [
    ...(catalogPaints || []).map((paint) => ({
      id: paint.id,
      source: 'catalog' as const,
      name: paint.name || 'Unnamed paint',
      brand: paint.brand,
      line: paint.line,
      sku: paint.sku,
      swatch_image_url: paint.swatch_image_url,
      hex: paint.hex_approx,
      hex_approx: paint.hex_approx,
      is_owned: ownedSet.has(paint.id),
      is_wishlist: wishlistSet.has(paint.id),
    })),
    ...customPaints,
  ]
    .sort((a, b) => {
      return (
        (a.brand || '').localeCompare(b.brand || '') ||
        (a.line || '').localeCompare(b.line || '') ||
        a.name.localeCompare(b.name)
      )
    })
    .slice(0, limit)

  if (!includeFilters) {
    return NextResponse.json({ paints })
  }

  try {
    const [
      catalogBrandRows,
      customBrandRows,
      catalogLineRows,
      customLineRows,
    ] = await Promise.all([
      getCatalogFilterRows(),
      getCustomFilterRows(),
      getCatalogFilterRows(brand),
      getCustomFilterRows(brand),
    ])

    const brandRows: CatalogFilterRow[] = [
      ...catalogBrandRows,
      ...customBrandRows.map((row) => ({
        brand: row.manufacturer || 'Custom',
        line: row.series || 'Custom Color',
      })),
    ]

    const lineRows: CatalogFilterRow[] = [
      ...catalogLineRows,
      ...customLineRows.map((row) => ({
      brand: row.manufacturer || 'Custom',
      line: row.series || 'Custom Color',
      })),
    ]

    return NextResponse.json({
      paints,
      filters: {
        brands: uniqueSorted(brandRows.map((row) => row.brand)),
        lines: uniqueSorted(lineRows.map((row) => row.line)),
      },
    })
  } catch (filterError) {
    return NextResponse.json(
      {
        error:
          filterError instanceof Error
            ? filterError.message
            : 'Failed to load paint filters',
      },
      { status: 500 }
    )
  }
}
