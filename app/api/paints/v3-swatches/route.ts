import { NextResponse } from 'next/server'
import { getPaintSwatchImageUrl } from '../../../paints/paints-v3-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

type SwatchRequestBody = {
  paintIds?: unknown
}

const maxPaintIds = 1200

function normalizePaintIds(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((paintId): paintId is string => typeof paintId === 'string')
        .map((paintId) => paintId.trim())
        .filter(Boolean)
    )
  ).slice(0, maxPaintIds)
}

export async function POST(request: Request) {
  let body: SwatchRequestBody

  try {
    body = (await request.json()) as SwatchRequestBody
  } catch {
    return NextResponse.json({ swatches: {} })
  }

  const paintIds = normalizePaintIds(body.paintIds)

  if (paintIds.length === 0) {
    return NextResponse.json({ swatches: {} })
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ swatches: {} }, { status: 401 })
  }

  const catalogPaintIds = paintIds.filter(
    (paintId) => !paintId.startsWith('custom-')
  )
  const customPaintIds = paintIds
    .filter((paintId) => paintId.startsWith('custom-'))
    .map((paintId) => paintId.slice('custom-'.length))
    .filter(Boolean)
  const swatches: Record<string, string | null> = {}

  if (catalogPaintIds.length > 0) {
    const { data } = await supabase
      .from('paint_catalog')
      .select('id, swatch_image_url')
      .eq('is_active', true)
      .in('id', catalogPaintIds)

    for (const row of (data ?? []) as Array<{
      id: string
      swatch_image_url: string | null
    }>) {
      swatches[row.id] = getPaintSwatchImageUrl(row.swatch_image_url)
    }
  }

  if (customPaintIds.length > 0) {
    const { data } = await supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'paint')
      .eq('user_id', user.id)
      .eq('is_featured', true)
      .in('entity_id', customPaintIds)

    for (const row of (data ?? []) as Array<{
      entity_id: string
      image_url: string | null
    }>) {
      swatches[`custom-${row.entity_id}`] = getPaintSwatchImageUrl(
        row.image_url
      )
    }
  }

  return NextResponse.json({ swatches })
}
