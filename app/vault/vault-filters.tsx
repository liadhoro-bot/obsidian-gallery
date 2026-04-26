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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [{ data: catalogRows }, { data: customRows }, { data: ownershipRows }] =
    await Promise.all([
      supabase
        .from('paint_catalog')
        .select('id, brand, line, name, sku')
        .eq('is_active', true),

      supabase
        .from('paints')
        .select('id, manufacturer, series, name')
        .eq('user_id', user.id),

      supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id, is_owned')
        .eq('user_id', user.id),
    ])

  const ownedSet = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)
  )

  const catalogPaints =
    catalogRows?.map((paint) => ({
      id: paint.id,
      brand: paint.brand,
      line: paint.line,
      name: paint.name,
      sku: paint.sku,
      is_owned: ownedSet.has(paint.id),
    })) || []

  const customPaints =
    customRows?.map((paint) => ({
      id: paint.id,
      brand: paint.manufacturer,
      line: paint.series,
      name: paint.name,
      sku: null,
      is_owned: true,
    })) || []

  const allPaints = [...catalogPaints, ...customPaints]

  const filteredPaints = allPaints.filter((paint) => {
    const matchesSearch =
      !q ||
      paint.name?.toLowerCase().includes(q.toLowerCase()) ||
      paint.sku?.toLowerCase().includes(q.toLowerCase())

    const matchesBrand = !brand || paint.brand === brand
    const matchesLine = !line || paint.line === line

    const matchesOwnership =
  ownership === 'owned'
    ? paint.is_owned
    : ownership === 'not_owned'
      ? !paint.is_owned
      : true

    return matchesSearch && matchesBrand && matchesLine && matchesOwnership
  })

  const brandOptions = Array.from(
    new Set(allPaints.map((paint) => paint.brand).filter(Boolean))
  ).sort()

  const allLines = allPaints.map((paint) => ({
    brand: paint.brand,
    line: paint.line,
  }))

  return (
    <VaultFiltersForm
      q={q}
      brand={brand}
      line={line}
      ownership={ownership}
      brandOptions={brandOptions}
      allLines={allLines}
      visibleCount={filteredPaints.length}
    />
  )
}