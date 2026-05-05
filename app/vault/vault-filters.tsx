import { createClient } from '../../utils/supabase/server'
import VaultFiltersClient from './vault-filters-client'

type VaultFiltersProps = {
  q: string
  brand: string
  line: string
  ownership: string
  tab: 'find' | 'collection'
}

export default async function VaultFilters({
  q,
  brand,
  line,
  ownership,
  tab,
}: VaultFiltersProps) {
  const supabase = await createClient()

  const { data: catalogRows } = await supabase
    .from('paint_catalog')
    .select('brand, line')
    .eq('is_active', true)
    .order('brand', { ascending: true })
    .order('line', { ascending: true })

  const brands = Array.from(
    new Set((catalogRows || []).map((row) => row.brand).filter(Boolean))
  ) as string[]

  const lines = Array.from(
    new Set(
      (catalogRows || [])
        .filter((row) => !brand || row.brand === brand)
        .map((row) => row.line)
        .filter(Boolean)
    )
  ) as string[]

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