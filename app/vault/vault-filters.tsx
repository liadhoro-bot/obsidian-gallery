import { createClient } from '../../utils/supabase/server'
import VaultFiltersForm from './vault-filters-form'

type VaultFiltersProps = {
  q: string
  brand: string
  line: string
  ownership: string
}

export default async function VaultFilters({
  q,
  brand,
  line,
  ownership,
}: VaultFiltersProps) {
  const supabase = await createClient()

  const [{ data: allBrands }, { data: allLines }] = await Promise.all([
    supabase.from('paint_catalog').select('brand'),
    supabase.from('paint_catalog').select('brand, line'),
  ])

  const brandOptions = Array.from(
    new Set((allBrands || []).map((item) => item.brand).filter(Boolean))
  ).sort()

  return (
    <VaultFiltersForm
      q={q}
      brand={brand}
      line={line}
      ownership={ownership}
      brandOptions={brandOptions}
      allLines={allLines || []}
    />
  )
}