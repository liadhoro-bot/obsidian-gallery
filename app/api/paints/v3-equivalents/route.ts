import { NextResponse } from 'next/server'
import {
  catalogPaintFields,
  toCatalogPaint,
  type CatalogPaintRow,
  type OwnershipRow,
} from '../../../paints/paints-v3-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import {
  classifyPaintFamily,
  findPaintEquivalents,
  type EquivalentChartEdge,
  type EquivalentLinkedEdge,
} from '../../../../utils/paint-conversions/equivalents'

type EquivalentCatalogRow = CatalogPaintRow & { finish_type: string | null }

const LINKABLE_CONNECTION_TYPES = ['official_conversion', 'official_equivalent', 'manual_equivalent', 'admin_curated', 'community_equivalent']
// Second-degree links fan out fast; follow at most this many direct matches.
const MAX_LINK_SOURCES = 40
const catalogPageSize = 1000
const catalogTtlMs = 10 * 60 * 1000

type CatalogCache = { loadedAt: number; rows: Promise<EquivalentCatalogRow[]>; refreshing: boolean }
// On globalThis so the cache survives dev-server hot reloads of this module.
const cacheHolder = globalThis as typeof globalThis & { __equivalentsCatalog?: CatalogCache }

async function loadCatalog(supabase: Awaited<ReturnType<typeof createClient>>) {
  const page = (from: number) =>
    supabase
      .from('paint_catalog')
      .select([...catalogPaintFields, 'finish_type'].join(', '), from === 0 ? { count: 'exact' } : undefined)
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, from + catalogPageSize - 1)

  // First page brings the total; the remaining pages load in parallel.
  const first = await page(0)
  if (first.error) throw new Error(first.error.message)
  const total = first.count ?? 0
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(total / catalogPageSize) - 1) }, (_, i) => page((i + 1) * catalogPageSize))
  )
  const failed = rest.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)

  return [first, ...rest].flatMap((result) => (result.data ?? []) as unknown as EquivalentCatalogRow[])
}

// Stale-while-revalidate: only the very first request waits for the catalog;
// after the TTL, requests keep getting the previous copy while it refreshes.
function getCatalog(supabase: Awaited<ReturnType<typeof createClient>>) {
  const cached = cacheHolder.__equivalentsCatalog

  if (!cached) {
    const rows = loadCatalog(supabase)
    cacheHolder.__equivalentsCatalog = { loadedAt: Date.now(), rows, refreshing: false }
    rows.catch(() => {
      cacheHolder.__equivalentsCatalog = undefined
    })
    return rows
  }

  if (Date.now() - cached.loadedAt > catalogTtlMs && !cached.refreshing) {
    cached.refreshing = true
    loadCatalog(supabase)
      .then((rows) => {
        cacheHolder.__equivalentsCatalog = { loadedAt: Date.now(), rows: Promise.resolve(rows), refreshing: false }
      })
      .catch(() => {
        cached.refreshing = false
      })
  }

  return cached.rows
}

export async function GET(request: Request) {
  const paintId = new URL(request.url).searchParams.get('paintId')

  if (!paintId || paintId.startsWith('custom-')) {
    return NextResponse.json({ error: 'A catalog paint id is required.' }, { status: 400 })
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const [catalog, edgesResult] = await Promise.all([
    getCatalog(supabase),
    supabase
      .from('paint_conversion_edges')
      .select('target_paint_id, connection_type, source:paint_conversion_sources ( name )')
      .eq('source_paint_id', paintId)
      .eq('is_active', true)
      // Chart claims rank above everything, so only edges whose paint names
      // were matched confidently qualify; fuzzy matches wait for review.
      .eq('needs_review', false)
      .in('connection_type', LINKABLE_CONNECTION_TYPES),
  ])

  if (edgesResult.error) {
    return NextResponse.json({ error: edgesResult.error.message }, { status: 500 })
  }

  const source = catalog.find((paint) => paint.id === paintId)
  if (!source) {
    return NextResponse.json({ error: 'Paint not found.' }, { status: 404 })
  }

  const chartEdges: EquivalentChartEdge[] = (
    (edgesResult.data ?? []) as unknown as Array<{
      target_paint_id: string
      connection_type: string
      source: { name: string | null } | Array<{ name: string | null }> | null
    }>
  ).map((edge) => {
    const chart = Array.isArray(edge.source) ? edge.source[0] : edge.source
    return {
      paintId: edge.target_paint_id,
      sourceName: chart?.name ?? null,
      kind: edge.connection_type === 'community_equivalent' ? ('community' as const) : ('official' as const),
    }
  })

  // Second-degree: equivalents of the direct chart/cross-ref matches.
  const directIds = [...new Set(chartEdges.map((edge) => edge.paintId))].slice(0, MAX_LINK_SOURCES)
  const linkedEdges: EquivalentLinkedEdge[] = []
  if (directIds.length) {
    const { data: secondHop, error: secondHopError } = await supabase
      .from('paint_conversion_edges')
      .select('source_paint_id, target_paint_id')
      .in('source_paint_id', directIds)
      .eq('is_active', true)
      .eq('needs_review', false)
      .in('connection_type', LINKABLE_CONNECTION_TYPES)
      .limit(2000)

    if (secondHopError) {
      return NextResponse.json({ error: secondHopError.message }, { status: 500 })
    }

    const direct = new Set(directIds)
    const catalogNames = new Map(catalog.map((paint) => [paint.id, paint.name ?? 'paint']))
    const via = new Map<string, Set<string>>()
    for (const edge of secondHop ?? []) {
      if (edge.target_paint_id === paintId || direct.has(edge.target_paint_id)) continue
      if (!via.has(edge.target_paint_id)) via.set(edge.target_paint_id, new Set())
      via.get(edge.target_paint_id)!.add(catalogNames.get(edge.source_paint_id) ?? 'paint')
    }
    for (const [linkedId, names] of via) linkedEdges.push({ paintId: linkedId, via: [...names] })
  }

  const matches = findPaintEquivalents({ source, catalog, chartEdges, linkedEdges })
  const matchIds = matches.map((match) => match.paintId)
  const { data: ownershipRows, error: ownershipError } = matchIds.length
    ? await supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id, is_owned, is_wishlist')
        .eq('user_id', user.id)
        .in('paint_catalog_id', matchIds)
    : { data: [], error: null }

  if (ownershipError) {
    return NextResponse.json({ error: ownershipError.message }, { status: 500 })
  }

  const ownershipByPaintId = new Map(
    ((ownershipRows ?? []) as OwnershipRow[]).map((row) => [row.paint_catalog_id, row])
  )
  const catalogById = new Map(catalog.map((paint) => [paint.id, paint]))
  const paints = matchIds
    .map((id) => catalogById.get(id))
    .filter((paint) => paint !== undefined)
    .map((paint) => toCatalogPaint(paint, ownershipByPaintId, false))

  return NextResponse.json(
    {
      sourceId: source.id,
      family: classifyPaintFamily(source),
      paints,
      matches: Object.fromEntries(matches.map((match) => [match.paintId, match])),
    },
    { headers: { 'Cache-Control': 'private, max-age=300' } }
  )
}
