'use server'

import { revalidatePath } from 'next/cache'
import { captureServerEvent } from '../../utils/analytics/server'
import { createClient } from '../../utils/supabase/server'
import {
  VaultBatchFilters,
  countFilteredCatalogPaints,
  loadFilteredCatalogPaintIds,
  normalizeVaultBatchFilters,
} from './vault-query'

type BatchOwnershipOptions = {
  clearWishlist?: boolean
}

type ExistingOwnership = {
  paint_catalog_id: string
  is_owned: boolean | null
  is_wishlist: boolean | null
  units_owned: number | null
}

type PaintSetSearchResult = {
  id: string
  name: string
  brand: string
  line: string | null
  manufacturer: string | null
  description: string | null
  image_url: string | null
  paint_count: number
  owned_count: number
}

const BATCH_LIMIT = 1000
const CHUNK_SIZE = 200

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  return { supabase, user }
}

async function loadExistingOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  paintIds: string[]
) {
  const rows: ExistingOwnership[] = []

  for (const chunk of chunkArray(paintIds, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id, is_owned, is_wishlist, units_owned')
      .eq('user_id', userId)
      .in('paint_catalog_id', chunk)

    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as ExistingOwnership[]))
  }

  return new Map(rows.map((row) => [row.paint_catalog_id, row]))
}

async function upsertOwnershipRows({
  supabase,
  userId,
  paintIds,
  mode,
  clearWishlist = false,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  paintIds: string[]
  mode: 'owned' | 'wishlist' | 'remove-owned'
  clearWishlist?: boolean
}) {
  const uniquePaintIds = Array.from(new Set(paintIds))

  if (uniquePaintIds.length === 0) {
    throw new Error('No matching paints found.')
  }

  if (uniquePaintIds.length > BATCH_LIMIT) {
    throw new Error(`Batch actions are limited to ${BATCH_LIMIT} paints.`)
  }

  const existingByPaintId = await loadExistingOwnership(
    supabase,
    userId,
    uniquePaintIds
  )

  const rows = uniquePaintIds.map((paintId) => {
    const existing = existingByPaintId.get(paintId)
    const previousUnits = existing?.units_owned ?? 0

    if (mode === 'wishlist') {
      return {
        user_id: userId,
        paint_catalog_id: paintId,
        is_owned: existing?.is_owned ?? false,
        is_wishlist: true,
        units_owned: previousUnits,
      }
    }

    if (mode === 'remove-owned') {
      return {
        user_id: userId,
        paint_catalog_id: paintId,
        is_owned: false,
        is_wishlist: existing?.is_wishlist ?? false,
        units_owned: 0,
      }
    }

    return {
      user_id: userId,
      paint_catalog_id: paintId,
      is_owned: true,
      is_wishlist: clearWishlist ? false : existing?.is_wishlist ?? false,
      units_owned: Math.max(previousUnits || 1, 1),
    }
  })

  for (const chunk of chunkArray(rows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from('user_paint_ownership')
      .upsert(chunk, { onConflict: 'user_id,paint_catalog_id' })

    if (error) throw new Error(error.message)
  }

  revalidatePath('/vault')

  return uniquePaintIds.length
}

async function logPaintSetEvent({
  supabase,
  userId,
  paintSetId,
  action,
  count,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  paintSetId: string | null
  action: string
  count: number
}) {
  const { error } = await supabase.from('user_paint_set_events').insert({
    user_id: userId,
    paint_set_id: paintSetId,
    action,
    affected_paint_count: count,
  })

  if (error) {
    console.error('Paint set event logging failed:', error.message)
  }
}

export async function searchPaintSets(
  query = '',
  brand = '',
  line = ''
): Promise<PaintSetSearchResult[]> {
  const { supabase, user } = await requireUser()
  let paintSetQuery = supabase
    .from('paint_sets')
    .select('id, name, brand, line, manufacturer, description, image_url')
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })
    .limit(25)

  const cleanedQuery = query.trim()
  if (cleanedQuery) {
    paintSetQuery = paintSetQuery.or(
      `name.ilike.%${cleanedQuery}%,brand.ilike.%${cleanedQuery}%,line.ilike.%${cleanedQuery}%`
    )
  }

  if (brand.trim()) paintSetQuery = paintSetQuery.eq('brand', brand.trim())
  if (line.trim()) paintSetQuery = paintSetQuery.eq('line', line.trim())

  const { data: sets, error } = await paintSetQuery
  if (error) throw new Error(error.message)

  const setIds = (sets ?? []).map((set) => set.id as string)
  if (setIds.length === 0) return []

  const { data: items, error: itemError } = await supabase
    .from('paint_set_items')
    .select('paint_set_id, paint_id')
    .in('paint_set_id', setIds)

  if (itemError) throw new Error(itemError.message)

  const paintIds = Array.from(new Set((items ?? []).map((item) => item.paint_id)))
  const existingByPaintId = paintIds.length
    ? await loadExistingOwnership(supabase, user.id, paintIds)
    : new Map<string, ExistingOwnership>()

  return (sets ?? []).map((set) => {
    const setItems = (items ?? []).filter((item) => item.paint_set_id === set.id)
    const ownedCount = setItems.filter(
      (item) => existingByPaintId.get(item.paint_id)?.is_owned
    ).length

    return {
      id: set.id,
      name: set.name,
      brand: set.brand,
      line: set.line,
      manufacturer: set.manufacturer,
      description: set.description,
      image_url: set.image_url,
      paint_count: setItems.length,
      owned_count: ownedCount,
    }
  })
}

export async function getPaintSetDetails(paintSetId: string) {
  const { supabase, user } = await requireUser()
  const { data: paintSet, error } = await supabase
    .from('paint_sets')
    .select('id, name, brand, line, manufacturer, description, image_url, source_url')
    .eq('id', paintSetId)
    .eq('is_active', true)
    .single()

  if (error) throw new Error(error.message)

  const { data: items, error: itemError } = await supabase
    .from('paint_set_items')
    .select(
      `
      paint_id,
      quantity,
      paint:paint_catalog!inner (
        id,
        brand,
        line,
        name,
        sku,
        swatch_image_url,
        hex_approx
      )
    `
    )
    .eq('paint_set_id', paintSetId)

  if (itemError) throw new Error(itemError.message)

  const paintIds = (items ?? []).map((item) => item.paint_id as string)
  const existingByPaintId = paintIds.length
    ? await loadExistingOwnership(supabase, user.id, paintIds)
    : new Map<string, ExistingOwnership>()

  return {
    ...paintSet,
    paint_count: paintIds.length,
    owned_count: paintIds.filter(
      (paintId) => existingByPaintId.get(paintId)?.is_owned
    ).length,
    paints: (items ?? []).map((item) => {
      const paint = Array.isArray(item.paint) ? item.paint[0] : item.paint

      return {
        ...paint,
        quantity: item.quantity,
        is_owned: existingByPaintId.get(item.paint_id)?.is_owned ?? false,
        is_wishlist:
          existingByPaintId.get(item.paint_id)?.is_wishlist ?? false,
      }
    }),
  }
}

export async function countFilteredPaints(filters: VaultBatchFilters) {
  const { supabase, user } = await requireUser()

  return countFilteredCatalogPaints({
    supabase,
    userId: user.id,
    filters,
  })
}

export async function markPaintSetOwned(
  paintSetId: string,
  options: BatchOwnershipOptions = {}
) {
  const { supabase, user } = await requireUser()
  const details = await getPaintSetDetails(paintSetId)
  const paintIds = details.paints.map((paint) => paint.id)
  const count = await upsertOwnershipRows({
    supabase,
    userId: user.id,
    paintIds,
    mode: 'owned',
    clearWishlist: options.clearWishlist ?? true,
  })

  await Promise.all([
    captureServerEvent({
      distinctId: user.id,
      event: 'vault_batch_owned_set',
      properties: {
        paint_set_id: paintSetId,
        paint_count: count,
        brand: details.brand,
        line: details.line,
      },
    }),
    logPaintSetEvent({
      supabase,
      userId: user.id,
      paintSetId,
      action: 'owned_set',
      count,
    }),
  ])

  return { paint_count: count, paint_ids: paintIds }
}

export async function markFilteredPaintsOwned(
  filters: VaultBatchFilters,
  options: BatchOwnershipOptions = {}
) {
  const { supabase, user } = await requireUser()
  const normalized = normalizeVaultBatchFilters(filters)
  const paintIds = await loadFilteredCatalogPaintIds({
    supabase,
    userId: user.id,
    filters: normalized,
    limit: BATCH_LIMIT + 1,
  })
  const count = await upsertOwnershipRows({
    supabase,
    userId: user.id,
    paintIds,
    mode: 'owned',
    clearWishlist: options.clearWishlist ?? true,
  })

  await captureServerEvent({
    distinctId: user.id,
    event: 'vault_batch_owned_filtered',
    properties: {
      paint_count: count,
      brand: normalized.brand || null,
      line: normalized.line || null,
      ownership_filter: normalized.ownership,
      query_present: Boolean(normalized.q),
    },
  })

  await logPaintSetEvent({
    supabase,
    userId: user.id,
    paintSetId: null,
    action: 'owned_filtered',
    count,
  })

  return { paint_count: count, paint_ids: paintIds }
}

export async function markFilteredPaintsWishlist(filters: VaultBatchFilters) {
  const { supabase, user } = await requireUser()
  const normalized = normalizeVaultBatchFilters(filters)
  const paintIds = await loadFilteredCatalogPaintIds({
    supabase,
    userId: user.id,
    filters: normalized,
    limit: BATCH_LIMIT + 1,
  })
  const count = await upsertOwnershipRows({
    supabase,
    userId: user.id,
    paintIds,
    mode: 'wishlist',
  })

  await captureServerEvent({
    distinctId: user.id,
    event: 'vault_batch_wishlist_filtered',
    properties: {
      paint_count: count,
      brand: normalized.brand || null,
      line: normalized.line || null,
      ownership_filter: normalized.ownership,
      query_present: Boolean(normalized.q),
    },
  })

  await logPaintSetEvent({
    supabase,
    userId: user.id,
    paintSetId: null,
    action: 'wishlist_filtered',
    count,
  })

  return { paint_count: count, paint_ids: paintIds }
}

export async function removeFilteredPaintsOwned(filters: VaultBatchFilters) {
  const { supabase, user } = await requireUser()
  const normalized = normalizeVaultBatchFilters(filters)
  const paintIds = await loadFilteredCatalogPaintIds({
    supabase,
    userId: user.id,
    filters: normalized,
    limit: BATCH_LIMIT + 1,
  })
  const count = await upsertOwnershipRows({
    supabase,
    userId: user.id,
    paintIds,
    mode: 'remove-owned',
  })

  await captureServerEvent({
    distinctId: user.id,
    event: 'vault_batch_remove_owned_filtered',
    properties: {
      paint_count: count,
      brand: normalized.brand || null,
      line: normalized.line || null,
      ownership_filter: normalized.ownership,
      query_present: Boolean(normalized.q),
    },
  })

  await logPaintSetEvent({
    supabase,
    userId: user.id,
    paintSetId: null,
    action: 'remove_owned_filtered',
    count,
  })

  return { paint_count: count, paint_ids: paintIds }
}
