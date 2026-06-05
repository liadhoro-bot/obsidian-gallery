import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const q = searchParams.get('q') || ''
  const brand = searchParams.get('brand') || ''
  const line = searchParams.get('line') || ''
  const ownership = searchParams.get('ownership') || 'all'
  const from = Number(searchParams.get('from') || 0)
  const to = Number(searchParams.get('to') || 23)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ paints: [], hasMore: false })
  }

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
  const wishlistIds = Array.from(wishlistSet)

  let query = supabase
    .from('paint_catalog')
    .select(`
      id,
      brand,
      line,
      name,
      sku,
      swatch_image_url,
      hex_approx,
      paint_type
    `)
    .eq('is_active', true)

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
  }

  if (brand) {
    query = query.eq('brand', brand)
  }

  if (line) {
    query = query.eq('line', line)
  }

  if (ownership === 'custom') {
    query = query.in('id', ['00000000-0000-0000-0000-000000000000'])
  } else if (ownership === 'owned') {
    if (ownedIds.length === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      query = query.in('id', ownedIds)
    }
  }

  if (ownership === 'unowned' && ownedIds.length > 0) {
    query = query.not('id', 'in', `(${ownedIds.join(',')})`)
  }

  if (ownership === 'wishlist') {
    if (wishlistIds.length === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      query = query.in('id', wishlistIds)
    }
  }

  const { data } = await query
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(0, to + 1)

  const catalogPaints = (data || []).map((paint) => ({
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
  }))

  let customPaints: {
    id: string
    source: 'custom'
    brand: string | null
    line: string | null
    name: string | null
    sku: null
    swatch_image_url: string | null
    hex_approx: string | null
    paint_type: string | null
    is_owned: boolean
    is_wishlist: boolean
  }[] = []

  if (ownership === 'all' || ownership === 'custom') {
    let customQuery = supabase
      .from('paints')
      .select('id, name, manufacturer, series, paint_type, color_hex')
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
      .range(0, to + 1)

    const customPaintIds = customRows?.map((paint) => paint.id) || []

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
      (customImageRows || []).map((row) => [row.entity_id, row.image_url])
    )

    customPaints =
      customRows?.map((paint) => ({
        id: paint.id,
        source: 'custom',
        brand: paint.manufacturer,
        line: paint.series,
        name: paint.name,
        sku: null,
        swatch_image_url: featuredImageMap.get(paint.id) || null,
        hex_approx: paint.color_hex,
        paint_type: paint.paint_type,
        is_owned: true,
        is_wishlist: false,
      })) || []
  }

  const rows = [...catalogPaints, ...customPaints]
  const paints = rows.slice(from, to + 1)
  const hasMore = rows.length > to + 1

  return NextResponse.json({ paints, hasMore })
}
