import 'server-only'

import { findClosestPaints, isUsableColorHex } from '../../utils/color-matching'
import { createClient } from '../../utils/supabase/server'

export const EMPTY_UUID = '00000000-0000-0000-0000-000000000000'

export type VaultTab = 'find' | 'collection'

export type VaultBatchFilters = {
  q?: string
  brand?: string
  line?: string
  ownership?: string
  matchHex?: string
  tab?: VaultTab
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type CatalogFilterQuery<T> = {
  or(filters: string): T
  eq(column: string, value: string): T
  in(column: string, values: string[]): T
  not(column: string, operator: string, value: string): T
}

export type CatalogOwnershipState = {
  ownedSet: Set<string>
  wishlistSet: Set<string>
  ownedIds: string[]
  wishlistIds: string[]
}

function cleanText(value?: string | null) {
  return value?.trim() ?? ''
}

export function normalizeVaultBatchFilters(
  filters: VaultBatchFilters
): Required<VaultBatchFilters> {
  const tab = filters.tab === 'collection' ? 'collection' : 'find'

  return {
    q: cleanText(filters.q),
    brand: cleanText(filters.brand),
    line: cleanText(filters.line),
    ownership:
      tab === 'collection' ? 'owned' : cleanText(filters.ownership) || 'all',
    matchHex: tab === 'find' ? cleanText(filters.matchHex) : '',
    tab,
  }
}

export async function loadCatalogOwnershipState(
  supabase: SupabaseClient,
  userId: string
): Promise<CatalogOwnershipState> {
  const { data, error } = await supabase
    .from('user_paint_ownership')
    .select('paint_catalog_id, is_owned, is_wishlist')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  const ownedSet = new Set(
    (data ?? [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id as string)
  )
  const wishlistSet = new Set(
    (data ?? [])
      .filter((row) => row.is_wishlist)
      .map((row) => row.paint_catalog_id as string)
  )

  return {
    ownedSet,
    wishlistSet,
    ownedIds: Array.from(ownedSet),
    wishlistIds: Array.from(wishlistSet),
  }
}

export function applyCatalogVaultFilters<QueryBuilder extends CatalogFilterQuery<QueryBuilder>>(
  query: QueryBuilder,
  filters: Required<VaultBatchFilters>,
  ownershipState: CatalogOwnershipState
): QueryBuilder {
  let catalogQuery = query

  if (filters.q) {
    const cleanedQ = filters.q.trim()
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

  if (filters.brand) {
    catalogQuery = catalogQuery.eq('brand', filters.brand)
  }

  if (filters.line) {
    catalogQuery = catalogQuery.eq('line', filters.line)
  }

  if (filters.tab === 'collection') {
    return catalogQuery.in(
      'id',
      ownershipState.ownedIds.length ? ownershipState.ownedIds : [EMPTY_UUID]
    ) as QueryBuilder
  }

  if (filters.ownership === 'custom') {
    catalogQuery = catalogQuery.in('id', [EMPTY_UUID])
  }

  if (filters.ownership === 'owned') {
    catalogQuery = catalogQuery.in(
      'id',
      ownershipState.ownedIds.length ? ownershipState.ownedIds : [EMPTY_UUID]
    )
  }

  if (filters.ownership === 'unowned' && ownershipState.ownedIds.length > 0) {
    catalogQuery = catalogQuery.not(
      'id',
      'in',
      `(${ownershipState.ownedIds.join(',')})`
    )
  }

  if (filters.ownership === 'wishlist') {
    catalogQuery = catalogQuery.in(
      'id',
      ownershipState.wishlistIds.length
        ? ownershipState.wishlistIds
        : [EMPTY_UUID]
    )
  }

  return catalogQuery as QueryBuilder
}

export async function loadFilteredCatalogPaintIds({
  supabase,
  userId,
  filters,
  limit,
}: {
  supabase: SupabaseClient
  userId: string
  filters: VaultBatchFilters
  limit?: number
}) {
  const normalized = normalizeVaultBatchFilters(filters)
  const ownershipState = await loadCatalogOwnershipState(supabase, userId)

  if (normalized.matchHex) {
    if (!isUsableColorHex(normalized.matchHex)) return []

    let matchQuery = supabase
      .from('paint_catalog')
      .select('id, brand, line, name, sku, hex_approx, paint_type, color_match_enabled')
      .eq('is_active', true)
      .eq('color_match_enabled', true)
      .not('hex_approx', 'is', null)
      .filter('hex_approx', 'match', '^#[0-9A-Fa-f]{6}$')

    if (normalized.brand) matchQuery = matchQuery.eq('brand', normalized.brand)
    if (normalized.line) matchQuery = matchQuery.eq('line', normalized.line)

    const { data, error } = await matchQuery.limit(5000)
    if (error) throw new Error(error.message)

    const ownershipFilteredRows = (data ?? []).filter((paint) => {
      if (normalized.ownership === 'owned') return ownershipState.ownedSet.has(paint.id)
      if (normalized.ownership === 'unowned') return !ownershipState.ownedSet.has(paint.id)
      if (normalized.ownership === 'wishlist') return ownershipState.wishlistSet.has(paint.id)
      if (normalized.ownership === 'custom') return false
      return true
    })

    return findClosestPaints(normalized.matchHex, ownershipFilteredRows, {
      limit: limit ?? 24,
    }).map(({ paint }) => paint.id)
  }

  let query = supabase
    .from('paint_catalog')
    .select('id')
    .eq('is_active', true)

  query = applyCatalogVaultFilters(query, normalized, ownershipState)

  let orderedQuery = query
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })

  if (limit) {
    orderedQuery = orderedQuery.limit(limit)
  }

  const { data, error } = await orderedQuery
  if (error) throw new Error(error.message)

  return (data ?? []).map((paint) => paint.id as string)
}

export async function countFilteredCatalogPaints({
  supabase,
  userId,
  filters,
}: {
  supabase: SupabaseClient
  userId: string
  filters: VaultBatchFilters
}) {
  const normalized = normalizeVaultBatchFilters(filters)

  if (normalized.matchHex) {
    const ids = await loadFilteredCatalogPaintIds({
      supabase,
      userId,
      filters: normalized,
    })

    return ids.length
  }

  const ownershipState = await loadCatalogOwnershipState(supabase, userId)
  let query = supabase
    .from('paint_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  query = applyCatalogVaultFilters(query, normalized, ownershipState)

  const { count, error } = await query
  if (error) throw new Error(error.message)

  return count ?? 0
}
