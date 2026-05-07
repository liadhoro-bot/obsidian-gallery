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

async function getAllCatalogFilterRows() {
  const supabase = await createClient()

  const pageSize = 1000
  let from = 0
  let allRows: CatalogFilterRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from('paint_catalog')
      .select('brand, line')
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

export default async function VaultFilters({
  q,
  brand,
  line,
  ownership,
  tab,
}: VaultFiltersProps) {
  const catalogRows = await getAllCatalogFilterRows()

  const brands = Array.from(
    new Set(catalogRows.map((row) => row.brand).filter(Boolean))
  ).sort() as string[]

  const lines = Array.from(
    new Set(
      catalogRows
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