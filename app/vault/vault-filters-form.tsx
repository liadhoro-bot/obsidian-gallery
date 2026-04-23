'use client'

import { useEffect, useMemo, useState } from 'react'

type VaultFiltersFormProps = {
  q: string
  brand: string
  line: string
  ownership: string
  brandOptions: string[]
  allLines: { brand: string | null; line: string | null }[]
}

export default function VaultFiltersForm({
  q,
  brand,
  line,
  ownership,
  brandOptions,
  allLines,
}: VaultFiltersFormProps) {
  const hasActiveFilters = Boolean(q || brand || line || ownership)

  const [isOpen, setIsOpen] = useState(hasActiveFilters)
  const [searchValue, setSearchValue] = useState(q)
  const [brandValue, setBrandValue] = useState(brand)
  const [lineValue, setLineValue] = useState(line)
  const [ownershipValue, setOwnershipValue] = useState(ownership)

  useEffect(() => {
    if (hasActiveFilters) {
      setIsOpen(true)
    }
  }, [hasActiveFilters])

const lineOptions = useMemo(() => {
  const filtered = allLines.filter((item) => {
    if (!item.line) return false
    if (!brandValue) return true
    return item.brand === brandValue
  })

  return Array.from(
    new Set(
      filtered
        .map((item) => item.line)
        .filter((line): line is string => Boolean(line))
    )
  ).sort((a, b) => a.localeCompare(b))
}, [allLines, brandValue])

  useEffect(() => {
    if (!lineValue) return

    const stillValid = lineOptions.includes(lineValue)
    if (!stillValid) {
      setLineValue('')
    }
  }, [brandValue, lineOptions, lineValue])

  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <p className="text-sm text-neutral-400">
              Search and narrow your paint catalogue.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">
              {hasActiveFilters ? 'Active filters' : 'Show filters'}
            </span>

            <span className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-white">
              {isOpen ? '▲' : '▼'}
            </span>
          </div>
        </button>

        <a
          href="/vault"
          className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:border-neutral-500"
        >
          Reset
        </a>
      </div>

      {isOpen ? (
        <form method="GET" className="mt-4 grid gap-3 border-t border-neutral-800 pt-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-sm text-neutral-300">Search</label>
            <input
              type="text"
              name="q"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search by name or SKU"
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none placeholder:text-neutral-500"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-sm text-neutral-300">Brand</label>
            <select
              name="brand"
              value={brandValue}
              onChange={(e) => {
                const nextBrand = e.target.value
                setBrandValue(nextBrand)
                setLineValue('')
              }}
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
              value={lineValue}
              onChange={(e) => setLineValue(e.target.value)}
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
              value={ownershipValue}
              onChange={(e) => setOwnershipValue(e.target.value)}
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
      ) : null}
    </section>
  )
}