import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { getCachedCatalogFilterRows } from '../../lib/public-cache'

export type PaintsV3Paint = {
  id: string
  name: string
  brand: string
  line: string
  finish: string
  size: string
  color: string
  swatchImageUrl: string | null
  owned: boolean
  wish: boolean
  notes: string
}

export type PaintsV3Payload = {
  ownedPaints: PaintsV3Paint[]
  libraryPaints: PaintsV3Paint[]
  counts: {
    owned: number
    wishlist: number
    custom: number
    libraryLoaded: number
  }
  filters: {
    brands: string[]
    lines: string[]
  }
}

type CatalogPaintRow = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  paint_type: string | null
}

type CustomPaintRow = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  paint_type: string | null
  color_hex: string | null
}

type OwnershipRow = {
  paint_catalog_id: string
  is_owned: boolean | null
  is_wishlist: boolean | null
}

type CollectionOwnershipRow = OwnershipRow & {
  paint: CatalogPaintRow | CatalogPaintRow[] | null
}

const collectionLimit = 72
const libraryLimit = 1000
const customLimit = 36
const defaultPaintSize = '18ml'
const fallbackColors = [
  '#111417',
  '#5aa7c9',
  '#7a5d37',
  '#4eb282',
  '#d29631',
  '#d8bd83',
  '#b51d20',
  '#17b9c2',
  '#5943a7',
]

function isHexColor(value: string | null | undefined) {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value))
}

function fallbackColor(seed: string) {
  const index =
    seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    fallbackColors.length

  return fallbackColors[index] ?? fallbackColors[0]
}

function cleanLabel(value: string | null | undefined, fallback: string) {
  const cleanValue = value?.trim()
  return cleanValue || fallback
}

function getPaintSwatchImageUrl(value: string | null | undefined) {
  const swatchUrl =
    getSupabaseImageUrl(value, {
      width: 180,
      height: 90,
      resize: 'cover',
      quality: 72,
    }) ?? null

  if (!swatchUrl) {
    return null
  }

  try {
    const parsedUrl = new URL(swatchUrl)
    if (parsedUrl.hostname === 'ckzrvjisesooqcmmtvwl.supabase.co') {
      return `/api/paints/v3-swatch?src=${encodeURIComponent(swatchUrl)}`
    }
  } catch {
    return swatchUrl
  }

  return swatchUrl
}

function toCatalogPaint(
  paint: CatalogPaintRow,
  ownershipByPaintId: Map<string, OwnershipRow>
): PaintsV3Paint {
  const ownership = ownershipByPaintId.get(paint.id)
  const brand = cleanLabel(paint.brand, 'Catalog')
  const line = cleanLabel(paint.line, 'Paint')
  const finish = cleanLabel(paint.paint_type, 'Paint')

  return {
    id: paint.id,
    name: cleanLabel(paint.name, 'Unnamed Paint'),
    brand,
    line,
    finish,
    size: defaultPaintSize,
    color: isHexColor(paint.hex_approx) ? paint.hex_approx!.toUpperCase() : fallbackColor(paint.id),
    swatchImageUrl: getPaintSwatchImageUrl(paint.swatch_image_url),
    owned: ownership?.is_owned === true,
    wish: ownership?.is_wishlist === true,
    notes: `${brand} ${line}${paint.sku ? `, SKU ${paint.sku}` : ''}.`,
  }
}

function toCustomPaint(
  paint: CustomPaintRow,
  imageByPaintId: Map<string, string>
): PaintsV3Paint {
  const brand = cleanLabel(paint.manufacturer, 'Custom')
  const line = cleanLabel(paint.series, 'Mix')
  const finish = cleanLabel(paint.paint_type, 'Custom')

  return {
    id: `custom-${paint.id}`,
    name: cleanLabel(paint.name, 'Unnamed Mix'),
    brand,
    line,
    finish,
    size: 'Custom',
    color: isHexColor(paint.color_hex) ? paint.color_hex!.toUpperCase() : fallbackColor(paint.id),
    swatchImageUrl: getPaintSwatchImageUrl(imageByPaintId.get(paint.id)),
    owned: true,
    wish: false,
    notes: 'Custom mix saved in your paint collection.',
  }
}

function sortPaints(first: PaintsV3Paint, second: PaintsV3Paint) {
  return `${first.brand} ${first.line} ${first.name}`.localeCompare(
    `${second.brand} ${second.line} ${second.name}`
  )
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) =>
    first.localeCompare(second)
  )
}

async function loadCustomPaintImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  paintIds: string[]
) {
  if (paintIds.length === 0) {
    return new Map<string, string>()
  }

  const { data } = await supabase
    .from('image_assets')
    .select('entity_id, image_url')
    .eq('entity_type', 'paint')
    .eq('user_id', userId)
    .eq('is_featured', true)
    .in('entity_id', paintIds)

  return new Map(
    ((data ?? []) as Array<{ entity_id: string; image_url: string | null }>)
      .filter((row) => Boolean(row.image_url))
      .map((row) => [row.entity_id, row.image_url!])
  )
}

export const getPaintsV3Payload = cache(async (userId: string) => {
  const supabase = await createClient()

  const [
    ownershipResult,
    collectionResult,
    customResult,
    libraryResult,
    catalogFilterRows,
  ] =
    await Promise.all([
    supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id, is_owned, is_wishlist')
      .eq('user_id', userId),
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
          hex_approx,
          swatch_image_url,
          paint_type
        )
      `
      )
      .eq('user_id', userId)
      .or('is_owned.eq.true,is_wishlist.eq.true')
      .order('brand', { ascending: true, referencedTable: 'paint' })
      .order('line', { ascending: true, referencedTable: 'paint' })
      .order('name', { ascending: true, referencedTable: 'paint' })
      .limit(collectionLimit),
    supabase
      .from('paints')
      .select('id, name, manufacturer, series, paint_type, color_hex')
      .eq('user_id', userId)
      .order('manufacturer', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })
      .limit(customLimit),
    supabase
      .from('paint_catalog')
      .select('id, brand, line, name, sku, hex_approx, swatch_image_url, paint_type')
      .eq('is_active', true)
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .order('name', { ascending: true })
      .limit(libraryLimit),
    getCachedCatalogFilterRows(),
  ])

  if (ownershipResult.error) throw new Error(ownershipResult.error.message)
  if (collectionResult.error) throw new Error(collectionResult.error.message)
  if (customResult.error) throw new Error(customResult.error.message)
  if (libraryResult.error) throw new Error(libraryResult.error.message)

  const ownershipRows = (ownershipResult.data ?? []) as OwnershipRow[]
  const customRows = (customResult.data ?? []) as CustomPaintRow[]
  const customImageByPaintId = await loadCustomPaintImages(
    supabase,
    userId,
    customRows.map((paint) => paint.id)
  )
  const ownershipByPaintId = new Map(
    ownershipRows.map((row) => [row.paint_catalog_id, row])
  )
  const collectionCatalogPaints = ((collectionResult.data ??
    []) as CollectionOwnershipRow[])
    .map((row) => {
      const paint = Array.isArray(row.paint) ? row.paint[0] : row.paint
      if (!paint) return null
      return toCatalogPaint(paint, ownershipByPaintId)
    })
    .filter((paint) => paint !== null)
  const customPaints = customRows.map((paint) =>
    toCustomPaint(paint, customImageByPaintId)
  )
  const ownedPaints = [...collectionCatalogPaints, ...customPaints]
    .sort(sortPaints)
    .slice(0, collectionLimit)
  const libraryPaints = ((libraryResult.data ?? []) as CatalogPaintRow[]).map(
    (paint) => toCatalogPaint(paint, ownershipByPaintId)
  )
  const filterRows = [
    ...catalogFilterRows.map((row) => ({
      brand: cleanLabel(row.brand, 'Catalog'),
      line: cleanLabel(row.line, 'Paint'),
    })),
    ...ownedPaints.map((paint) => ({
      brand: paint.brand,
      line: paint.line,
    })),
  ]

  return {
    ownedPaints,
    libraryPaints,
    counts: {
      owned: ownershipRows.filter((row) => row.is_owned).length + customPaints.length,
      wishlist: ownershipRows.filter((row) => row.is_wishlist).length,
      custom: customPaints.length,
      libraryLoaded: libraryPaints.length,
    },
    filters: {
      brands: uniqueSorted(filterRows.map((paint) => paint.brand)),
      lines: uniqueSorted(filterRows.map((paint) => paint.line)),
    },
  } satisfies PaintsV3Payload
})
