'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomPaint } from './actions'

type VaultFiltersFormProps = {
  q: string
  brand: string
  line: string
  ownership: string
  brandOptions: string[]
  allLines: { brand: string | null; line: string | null }[]
  visibleCount: number
}

export default function VaultFiltersForm({
  q,
  brand,
  line,
  ownership,
  brandOptions,
  allLines,
  visibleCount,
}: VaultFiltersFormProps) {
  const router = useRouter()
  const hasActiveFilters = Boolean(q || brand || line || ownership)

  const [isOpen, setIsOpen] = useState(hasActiveFilters)
  const [searchValue, setSearchValue] = useState(q)
  const [brandValue, setBrandValue] = useState(brand)
  const [lineValue, setLineValue] = useState(line)
  const [ownershipValue, setOwnershipValue] = useState(ownership)
  const [isAddingCustomPaint, setIsAddingCustomPaint] = useState(false)

useEffect(() => {
  setSearchValue(q)
  setBrandValue(brand)
  setLineValue(line)
  setOwnershipValue(ownership || 'owned')
}, [q, brand, line, ownership])

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

function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  const params = new URLSearchParams()

  if (searchValue.trim()) {
    params.set('q', searchValue.trim())
  }

  if (brandValue) {
    params.set('brand', brandValue)
  }

  if (lineValue) {
    params.set('line', lineValue)
  }

  params.set('ownership', ownershipValue)

  router.push(`/vault?${params.toString()}`)
}

  return (
    <section>
      <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-200 shadow-sm transition hover:border-cyan-500"
          aria-label="Toggle filters"
        >
          <span className="text-xl">{isOpen ? '×' : '≡'}</span>
        </button>

        <div className="flex h-16 flex-col justify-center rounded-2xl border border-neutral-800 bg-neutral-900 px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
            Showing
          </p>
          <p className="text-lg font-black text-white">
            {visibleCount} Color{visibleCount === 1 ? '' : 's'}
          </p>
        </div>

        <button
  type="button"
  onClick={() => setIsAddingCustomPaint((prev) => !prev)}
  className="flex h-16 items-center justify-center rounded-2xl bg-cyan-500 px-5 text-sm font-black uppercase tracking-[0.12em] text-black shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-400"
>
  {isAddingCustomPaint ? 'Close' : '+ New Paint'}
</button>
      </div>
{isAddingCustomPaint ? (
  <div className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
    <form action={createCustomPaint} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm text-neutral-300">Name</label>
        <input
          name="name"
          type="text"
          required
          placeholder="For example: Necro Violet"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-300">Brand</label>
        <input
          name="manufacturer"
          type="text"
          placeholder="Scale75"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-300">Line</label>
        <input
          name="series"
          type="text"
          placeholder="Layer Paint"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-300">
          Paint Type
        </label>
        <input
          name="paintType"
          type="text"
          placeholder="Acrylic"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-300">
          Color Hex
        </label>
        <input
          name="colorHex"
          type="text"
          placeholder="#7a5ca8"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <button
          type="submit"
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
        >
          Save Paint
        </button>

        <button
          type="button"
          onClick={() => setIsAddingCustomPaint(false)}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white transition hover:bg-neutral-700"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
) : null}
      {isOpen ? (
        <form
  onSubmit={handleFilterSubmit}
          className="mt-4 grid gap-3 rounded-3xl border border-neutral-800 bg-neutral-900 p-4 lg:grid-cols-12"
        >
          <div className="lg:col-span-4">
            <label className="mb-1 block text-sm text-neutral-300">
              Search
            </label>
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
            <label className="mb-1 block text-sm text-neutral-300">
              Brand
            </label>
            <select
              name="brand"
              value={brandValue}
              onChange={(e) => {
                setBrandValue(e.target.value)
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
            <label className="mb-1 block text-sm text-neutral-300">
              Ownership
            </label>
            <select
              name="ownership"
              value={ownershipValue}
              onChange={(e) => setOwnershipValue(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            >
              <option value="all">All</option>
<option value="owned">Owned</option>
<option value="not_owned">Not owned</option>
            </select>
          </div>

          <div className="flex gap-2 lg:col-span-12">
            <button
              type="submit"
              className="rounded-xl bg-cyan-500 px-4 py-2 font-bold text-black hover:bg-cyan-400"
            >
              Apply filters
            </button>

            <a
              href="/vault?ownership=owned"
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-2 font-bold text-white hover:border-neutral-500"
            >
              Reset
            </a>
          </div>
        </form>
      ) : null}
    </section>
  )
}