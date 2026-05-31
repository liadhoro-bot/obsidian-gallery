import { createClient } from '../../utils/supabase/server'
import { getCachedCatalogFilterRows } from '../../lib/public-cache'
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
    getCachedCatalogFilterRows(),
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
