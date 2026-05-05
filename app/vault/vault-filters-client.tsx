'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type VaultFiltersClientProps = {
  q: string
  brand: string
  line: string
  ownership: string
  tab: 'find' | 'collection'
  brands: string[]
  lines: string[]
}

export default function VaultFiltersClient({
  q,
  brand,
  line,
  ownership,
  tab,
  brands,
  lines,
}: VaultFiltersClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(q)

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams()

    params.set('tab', tab)

    const nextQ = key === 'q' ? value : q
    const nextBrand = key === 'brand' ? value : brand
    const nextLine = key === 'line' ? value : line
    const nextOwnership = key === 'ownership' ? value : ownership

    if (nextQ) params.set('q', nextQ)
    if (nextBrand) params.set('brand', nextBrand)

    if (key !== 'brand' && nextLine) {
      params.set('line', nextLine)
    }

    if (tab === 'find' && nextOwnership && nextOwnership !== 'all') {
      params.set('ownership', nextOwnership)
    }

    startTransition(() => {
      router.replace(`/vault?${params.toString()}`)
    })
  }

  useEffect(() => {
    setSearchValue(q)
  }, [q])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== q) {
        updateParam('q', searchValue)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [searchValue, q])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Search by name, hex, or brand..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <select
          value={brand}
          onChange={(event) => updateParam('brand', event.target.value)}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
        >
          <option value="">Brand</option>
          {brands.map((brandOption) => (
            <option key={brandOption} value={brandOption}>
              {brandOption}
            </option>
          ))}
        </select>

        <select
          value={line}
          onChange={(event) => updateParam('line', event.target.value)}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
        >
          <option value="">Line</option>
          {lines.map((lineOption) => (
            <option key={lineOption} value={lineOption}>
              {lineOption}
            </option>
          ))}
        </select>

        <select
          value={tab === 'collection' ? 'owned' : ownership}
          onChange={(event) => updateParam('ownership', event.target.value)}
          disabled={tab === 'collection'}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none disabled:opacity-70"
        >
          {tab === 'collection' ? (
            <option value="owned">Owned</option>
          ) : (
            <>
              <option value="all">All</option>
              <option value="owned">Owned</option>
              <option value="unowned">Unowned</option>
              <option value="wishlist">Wishlist</option>
            </>
          )}
        </select>
      </div>
    </div>
  )
}