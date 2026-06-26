import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import { createClient } from '../../../../utils/supabase/server'
import {
  deltaE,
  deltaEToSimilarityScore,
  hexToLab,
  isUsableHex,
  type LabColor,
} from '../../../../utils/paint-conversions'
import {
  getSimilarPaints,
  type SimilarPaintResult,
} from '../../../../utils/paint-conversions'

export const dynamic = 'force-dynamic'

type CatalogPaintForFallback = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  paint_type: string | null
  finish_type: string | null
  is_color_matchable: boolean | null
  lab_l: number | null
  lab_a: number | null
  lab_b: number | null
}

function paintLab(paint: CatalogPaintForFallback): LabColor | null {
  if (
    typeof paint.lab_l === 'number' &&
    typeof paint.lab_a === 'number' &&
    typeof paint.lab_b === 'number'
  ) {
    return { l: paint.lab_l, a: paint.lab_a, b: paint.lab_b }
  }

  if (isUsableHex(paint.hex_approx)) {
    return hexToLab(paint.hex_approx)
  }

  return null
}

function canUseColorFallback(
  source: CatalogPaintForFallback,
  target: CatalogPaintForFallback
) {
  const sourceFinish = source.finish_type || 'standard'
  const targetFinish = target.finish_type || 'standard'
  const specialFinishes = new Set(['metallic', 'technical', 'texture', 'medium'])

  if (specialFinishes.has(sourceFinish) || specialFinishes.has(targetFinish)) {
    return sourceFinish === targetFinish
  }

  return true
}

async function getFallbackColorPaints({
  paintId,
  existingIds,
  needed,
  userId,
}: {
  paintId: string
  existingIds: Set<string>
  needed: number
  userId?: string
}) {
  if (needed <= 0) return []

  const supabase = createServiceRoleClient()
  const { data: sourcePaint, error: sourceError } = await supabase
    .from('paint_catalog')
    .select(
      'id, brand, line, name, sku, swatch_image_url, hex_approx, paint_type, finish_type, is_color_matchable, lab_l, lab_a, lab_b'
    )
    .eq('id', paintId)
    .maybeSingle()

  if (sourceError) throw sourceError
  if (!sourcePaint) return []

  const source = sourcePaint as CatalogPaintForFallback
  const sourceLab = paintLab(source)

  const { data: catalogRows, error: catalogError } = await supabase
    .from('paint_catalog')
    .select(
      'id, brand, line, name, sku, swatch_image_url, hex_approx, paint_type, finish_type, is_color_matchable, lab_l, lab_a, lab_b'
    )
    .eq('is_active', true)
    .eq('is_color_matchable', true)
    .neq('id', paintId)
    .limit(5000)

  if (catalogError) throw catalogError

  const candidates = ((catalogRows ?? []) as CatalogPaintForFallback[])
    .filter((paint) => !existingIds.has(paint.id))
    .filter((paint) => canUseColorFallback(source, paint))
    .map((paint) => {
      const targetLab = sourceLab ? paintLab(paint) : null
      const distance =
        sourceLab && targetLab ? deltaE(sourceLab, targetLab) : Number.POSITIVE_INFINITY

      return { paint, distance }
    })
    .filter((candidate) => Number.isFinite(candidate.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, needed)

  let results: SimilarPaintResult[] = candidates.map(({ paint, distance }) => ({
    id: paint.id,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    sku: paint.sku,
    swatch_image_url: paint.swatch_image_url,
    hex_approx: paint.hex_approx,
    paint_type: paint.paint_type,
    score: deltaEToSimilarityScore(distance) * 0.3,
    explanation: 'close LAB color match',
    best_connection_type: 'hex_similarity',
    source_count: 0,
    min_delta_e: distance,
    is_owned: null,
    is_wishlist: null,
  }))

  if (results.length < needed) {
    const seen = new Set([...existingIds, ...results.map((paint) => paint.id)])
    const sameLineFallbacks = ((catalogRows ?? []) as CatalogPaintForFallback[])
      .filter((paint) => !seen.has(paint.id))
      .filter((paint) => paint.brand === source.brand && paint.line === source.line)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .slice(0, needed - results.length)

    results = [
      ...results,
      ...sameLineFallbacks.map((paint) => ({
        id: paint.id,
        brand: paint.brand,
        line: paint.line,
        name: paint.name,
        sku: paint.sku,
        swatch_image_url: paint.swatch_image_url,
        hex_approx: paint.hex_approx,
        paint_type: paint.paint_type,
        score: 0.05,
        explanation: 'same paint range fallback',
        best_connection_type: 'range_fallback',
        source_count: 0,
        min_delta_e: null,
        is_owned: null,
        is_wishlist: null,
      })),
    ]
  }

  if (results.length < needed) {
    const seen = new Set([...existingIds, ...results.map((paint) => paint.id)])
    const broadFallbacks = ((catalogRows ?? []) as CatalogPaintForFallback[])
      .filter((paint) => !seen.has(paint.id))
      .sort((a, b) => {
        const brandCompare = (a.brand || '').localeCompare(b.brand || '')
        if (brandCompare !== 0) return brandCompare

        const lineCompare = (a.line || '').localeCompare(b.line || '')
        if (lineCompare !== 0) return lineCompare

        return (a.name || '').localeCompare(b.name || '')
      })
      .slice(0, needed - results.length)

    results = [
      ...results,
      ...broadFallbacks.map((paint) => ({
        id: paint.id,
        brand: paint.brand,
        line: paint.line,
        name: paint.name,
        sku: paint.sku,
        swatch_image_url: paint.swatch_image_url,
        hex_approx: paint.hex_approx,
        paint_type: paint.paint_type,
        score: 0.01,
        explanation: 'catalog fallback',
        best_connection_type: 'catalog_fallback',
        source_count: 0,
        min_delta_e: null,
        is_owned: null,
        is_wishlist: null,
      })),
    ]
  }

  if (userId && results.length > 0) {
    const { data: ownershipRows, error: ownershipError } = await supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id, is_owned, is_wishlist')
      .eq('user_id', userId)
      .in(
        'paint_catalog_id',
        results.map((paint) => paint.id)
      )

    if (ownershipError) throw ownershipError

    const ownership = new Map(
      (ownershipRows ?? []).map((row) => [row.paint_catalog_id, row])
    )

    results = results.map((paint) => ({
      ...paint,
      is_owned: ownership.get(paint.id)?.is_owned ?? false,
      is_wishlist: ownership.get(paint.id)?.is_wishlist ?? false,
    }))
  }

  return results
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const paintId = searchParams.get('paintId')
  const limit = Math.max(3, Number(searchParams.get('limit') || 9))
  const minimum = Math.min(limit, Math.max(3, Number(searchParams.get('minimum') || 3)))

  if (!paintId) {
    return NextResponse.json({ paints: [] }, { status: 400 })
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()
  const serviceSupabase = createServiceRoleClient()
  const officialPaints = await getSimilarPaints(serviceSupabase, paintId, {
    limit,
    officialOnly: true,
    includeLooseMatches: true,
    userId: user?.id,
  })
  const existingIds = new Set(officialPaints.map((paint) => paint.id))
  const fallbackPaints =
    officialPaints.length < minimum
      ? await getFallbackColorPaints({
          paintId,
          existingIds,
          needed: minimum - officialPaints.length,
          userId: user?.id,
        })
      : []

  return NextResponse.json(
    { paints: [...officialPaints, ...fallbackPaints].slice(0, limit) },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
