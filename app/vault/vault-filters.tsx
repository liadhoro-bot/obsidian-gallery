import { createClient } from '../../utils/supabase/server'
import VaultFiltersClient from './vault-filters-client'

type VaultFiltersProps = {
  q: string
  brand: string
  line: string
  ownership: string
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

async function getAllCatalogFilterRows() {
  const supabase = await createClient()

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

    const rows = data || []
    allRows = [...allRows, ...rows]

    if (rows.length < pageSize) break

    from += pageSize
  }

  return allRows
}

async function getCustomFilterRows(userId: string) {
  const supabase = await createClient()

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
  tab,
}: VaultFiltersProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [catalogRows, customRows] = await Promise.all([
    getAllCatalogFilterRows(),
    user ? getCustomFilterRows(user.id) : Promise.resolve([]),
  ])

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

  return (
    <VaultFiltersClient
      q={q}
      brand={brand}
      line={line}
      ownership={ownership}
      tab={tab}
      brands={brands}
      lines={lines}
    />
  )
}