import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

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
    supabase.from('paint_catalog').select('line'),
  ])

  const brandOptions = Array.from(
    new Set((allBrands || []).map((item) => item.brand).filter(Boolean))
  ).sort()

  const lineOptions = Array.from(
    new Set((allLines || []).map((item) => item.line).filter(Boolean))
  ).sort()

  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <p className="text-sm text-neutral-400">
            Search and narrow your paint catalogue.
          </p>
        </div>

        <Link
          href="/vault"
          className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:border-neutral-500"
        >
          Reset
        </Link>
      </div>

      <form method="GET" className="mt-4 grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <label className="mb-1 block text-sm text-neutral-300">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by name or SKU"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none placeholder:text-neutral-500"
          />
        </div>

        <div className="lg:col-span-3">
          <label className="mb-1 block text-sm text-neutral-300">Brand</label>
          <select
            name="brand"
            defaultValue={brand}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          >
            <option value="">All brands</option>
            {brandOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <label className="mb-1 block text-sm text-neutral-300">Line</label>
          <select
            name="line"
            defaultValue={line}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          >
            <option value="">All lines</option>
            {lineOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-sm text-neutral-300">Ownership</label>
          <select
            name="ownership"
            defaultValue={ownership}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          >
            <option value="">All</option>
            <option value="owned">Owned</option>
            <option value="not_owned">Not owned</option>
          </select>
        </div>

        <div className="lg:col-span-12 flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black hover:bg-cyan-400"
          >
            Apply filters
          </button>
        </div>
      </form>
    </section>
  )
}