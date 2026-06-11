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

export default async function VaultFilters({
  q,
  brand,
  line,
  ownership,
  matchHex,
  tab,
}: VaultFiltersProps) {
  const perf = createPerfTimer('/vault:filters')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  const [catalogRows, customRows] = await Promise.all([
    getCatalogFilterRows(supabase),
    user ? getCustomFilterRows(supabase, user.id) : Promise.resolve([]),
  ])
  perf.mark('filter Supabase queries')

  const customAsFilterRows: CatalogFilterRow[] = customRows.map((row) => ({
    brand: row.manufacturer || 'Custom',
    line: row.series || 'Custom Color',
  }))

  const allRows =
    tab === 'collection'
      ? [...catalogRows, ...customAsFilterRows]
      : catalogRows

  const brands = Array.from(
    new Set(allRows.map((row) => row.brand).filter(Boolean))
  ).sort() as string[]

  const lines = Array.from(
    new Set(
      allRows
        .filter((row) => !brand || row.brand === brand)
        .map((row) => row.line)
        .filter(Boolean)
    )
  ).sort() as string[]
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
      lines={lines}
    />
  )
}
