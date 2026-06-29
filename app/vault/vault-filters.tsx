import { createClient } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import VaultFiltersClient from './vault-filters-client'

type VaultFiltersProps = {
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  tab: 'find' | 'collection'
  userId: string
}

type CatalogFilterRow = {
  brand: string | null
  line: string | null
}

type CustomFilterRow = {
  manufacturer: string | null
  series: string | null
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function isPresentText(value: string | null): value is string {
  return Boolean(value)
}

async function getCatalogFilterRows(supabase: SupabaseClient) {
  const pageSize = 1000
  let from = 0
  let allRows: CatalogFilterRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('brand,line')
      .eq('is_active', true)
      .order('brand', { ascending: true })
      .order('line', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error

    const rows = (data || []) as CatalogFilterRow[]
    allRows = [...allRows, ...rows]

    if (rows.length < pageSize) break

    from += pageSize
  }

  return allRows
}

async function safelyGetCatalogFilterRows(supabase: SupabaseClient) {
  try {
    return await getCatalogFilterRows(supabase)
  } catch (error) {
    console.error('Vault catalog filters failed:', error)
    return [] as CatalogFilterRow[]
  }
}

async function getCustomFilterRows(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from('paints')
    .select('manufacturer,series')
    .eq('user_id', userId)
    .order('manufacturer', { ascending: true })
    .order('series', { ascending: true })

  if (error) throw error

  return (data || []) as CustomFilterRow[]
}

async function safelyGetCustomFilterRows(
  supabase: SupabaseClient,
  userId: string
) {
  try {
    return await getCustomFilterRows(supabase, userId)
  } catch (error) {
    console.error('Vault custom filters failed:', error)
    return [] as CustomFilterRow[]
  }
}

export default async function VaultFilters({
  q,
  brand,
  line,
  ownership,
  matchHex,
  tab,
  userId,
}: VaultFiltersProps) {
  const perf = createPerfTimer('/vault:filters')
  const supabase = await createClient()

  const [catalogRows, customRows] = await Promise.all([
    safelyGetCatalogFilterRows(supabase),
    userId ? safelyGetCustomFilterRows(supabase, userId) : Promise.resolve([]),
  ])
  perf.mark('filter Supabase queries')

  const customAsFilterRows: CatalogFilterRow[] = customRows
    .map((row) => ({
      brand: row.manufacturer?.trim() || null,
      line: row.series?.trim() || null,
    }))
    .filter((row) => row.brand || row.line)

  const allRows = [...catalogRows, ...customAsFilterRows]

  const filterRows = allRows
    .map((row) => ({
      brand: row.brand?.trim() || null,
      line: row.line?.trim() || null,
    }))
    .filter((row) => row.brand || row.line)

  const brands = Array.from(
    new Set(filterRows.map((row) => row.brand).filter(isPresentText))
  ).sort((a, b) => a.localeCompare(b)) as string[]
  perf.total()

  return (
    <VaultFiltersClient
      q={q}
      brand={brand}
      line={line}
      ownership={ownership}
      matchHex={matchHex}
      tab={tab}
      brands={brands}
      filterRows={filterRows}
    />
  )
}
