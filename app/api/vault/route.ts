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

  if (ownership === 'owned') {
    if (ownedIds.length === 0) {
      query = query.in('id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      query = query.in('id', ownedIds)
    }
  }

  if (ownership === 'not_owned' && ownedIds.length > 0) {
    query = query.not('id', 'in', `(${ownedIds.join(',')})`)
  }

  const { data } = await query
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .range(from, to + 1)

  const rows = data || []
  const hasMore = rows.length > to - from + 1

  const paints = rows.slice(0, to - from + 1).map((paint) => ({
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

  return NextResponse.json({ paints, hasMore })
}