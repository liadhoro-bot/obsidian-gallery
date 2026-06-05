'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import BarcodeScannerModal from './barcode-scanner-modal'

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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [localBrand, setLocalBrand] = useState(brand)
  const [localLine, setLocalLine] = useState(line)
  const [localOwnership, setLocalOwnership] = useState(
    tab === 'collection' ? 'owned' : ownership || 'all'
  )

  const pushVaultParams = useCallback((nextValues?: {
    q?: string
    brand?: string
    line?: string
    ownership?: string
  }) => {
    const params = new URLSearchParams()

    params.set('tab', tab)

    const nextQ = nextValues?.q ?? searchValue
    const nextBrand = nextValues?.brand ?? localBrand
    const nextLine = nextValues?.line ?? localLine
    const nextOwnership = nextValues?.ownership ?? localOwnership

    if (nextQ) params.set('q', nextQ)
    if (nextBrand) params.set('brand', nextBrand)
    if (nextLine) params.set('line', nextLine)

    if (tab === 'find' && nextOwnership && nextOwnership !== 'all') {
      params.set('ownership', nextOwnership)
    }

    startTransition(() => {
      router.replace(`/vault?${params.toString()}`)
    })
  }, [localBrand, localLine, localOwnership, router, searchValue, startTransition, tab])

  const updateParam = useCallback((key: string, value: string) => {
    const nextQ = key === 'q' ? value : searchValue
    const nextBrand = key === 'brand' ? value : localBrand
    const nextLine = key === 'brand' ? '' : key === 'line' ? value : localLine
    const nextOwnership =
      key === 'ownership' ? value : localOwnership

    pushVaultParams({
      q: nextQ,
      brand: nextBrand,
      line: nextLine,
      ownership: nextOwnership,
    })
  }, [localBrand, localLine, localOwnership, pushVaultParams, searchValue])

  function handleBarcodeDetected(barcode: string) {
    const cleanedBarcode = barcode.replace(/\D/g, '')

    if (!cleanedBarcode) return

    setSearchValue(cleanedBarcode)
    pushVaultParams({ q: cleanedBarcode })
  }

  useEffect(() => {
    setSearchValue(q)
  }, [q])

  useEffect(() => {
    setLocalBrand(brand)
  }, [brand])

  useEffect(() => {
    setLocalLine(line)
  }, [line])

  useEffect(() => {
    setLocalOwnership(tab === 'collection' ? 'owned' : ownership || 'all')
  }, [ownership, tab])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== q) {
        updateParam('q', searchValue)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [searchValue, q, updateParam])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name, brand, line, or barcode"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/60 hover:bg-cyan-300/15"
          aria-label="Scan barcode"
        >
          <BarcodeScanIcon />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <select
          value={localBrand}
          onChange={(event) => {
            setLocalBrand(event.target.value)
            setLocalLine('')
            updateParam('brand', event.target.value)
          }}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
        >
          <option value="" className="bg-slate-950 text-white">
            Brand
          </option>
          {brands.map((brandOption) => (
            <option
              key={brandOption}
              value={brandOption}
              className="bg-slate-950 text-white"
            >
              {brandOption}
            </option>
          ))}
        </select>

        <select
          value={localLine}
          onChange={(event) => {
            setLocalLine(event.target.value)
            updateParam('line', event.target.value)
          }}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
        >
          <option value="" className="bg-slate-950 text-white">
            Line
          </option>
          {lines.map((lineOption) => (
            <option
              key={lineOption}
              value={lineOption}
              className="bg-slate-950 text-white"
            >
              {lineOption}
            </option>
          ))}
        </select>

        <select
          value={localOwnership}
          onChange={(event) => {
            setLocalOwnership(event.target.value)
            updateParam('ownership', event.target.value)
          }}
          disabled={tab === 'collection'}
          className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none disabled:opacity-70"
        >
          {tab === 'collection' ? (
            <option value="owned" className="bg-slate-950 text-white">
              Owned
            </option>
          ) : (
            <>
              <option value="all" className="bg-slate-950 text-white">
                All
              </option>
              <option value="owned" className="bg-slate-950 text-white">
                Owned
              </option>
              <option value="unowned" className="bg-slate-950 text-white">
                Unowned
              </option>
              <option value="wishlist" className="bg-slate-950 text-white">
                Wishlist
              </option>
              <option value="custom" className="bg-slate-950 text-white">
                Custom
              </option>
            </>
          )}
        </select>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcodeDetected}
      />
    </div>
  )
}

function BarcodeScanIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 10V6h4M23 6h4v4M27 22v4h-4M9 26H5v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 20h18"
        stroke="#f87171"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 11v8M11 11v8M14 11v8M18 11v8M21 11v8M24 11v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
