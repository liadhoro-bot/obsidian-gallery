import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const q = searchParams.get('q')?.trim() || ''
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100)

  let query = supabase
    .from('paint_catalog')
    .select('id, name, brand, line, sku, swatch_image_url, hex_approx')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit)

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,brand.ilike.%${q}%,line.ilike.%${q}%,sku.ilike.%${q}%`
    )
  }

  const { data: catalogPaints, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const paints = (catalogPaints || []).map((paint) => ({
    id: paint.id,
    source: 'catalog' as const,
    name: paint.name || 'Unnamed paint',
    brand: paint.brand,
    line: paint.line,
    sku: paint.sku,
    swatch_image_url: paint.swatch_image_url,
    hex: paint.hex_approx,
  }))

  return NextResponse.json({ paints })
}