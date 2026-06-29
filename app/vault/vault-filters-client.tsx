'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const BarcodeScannerModal = dynamic(() => import('./barcode-scanner-modal'), {
  ssr: false,
})
const ColorMatchModal = dynamic(() => import('./color-match-modal'))

const COLOR_GROUP_OPTIONS = [
  'Blacks & Greys',
  'Whites',
  'Browns',
  'Reds',
  'Oranges',
  'Yellows',
  'Greens',
  'Blues',
  'Purples',
  'Flesh Tones',
  'Metallics',
  'Auxiliary',
]

type VaultFiltersClientProps = {
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  tab: 'find' | 'collection'
  brands: string[]
  filterRows: { brand: string | null; line: string | null }[]
}

export default function VaultFiltersClient({
  q,
  brand,
  line,
  ownership,
  matchHex,
  tab,
  brands = [],
  filterRows = [],
}: VaultFiltersClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [searchValue, setSearchValue] = useState(q)
  const searchValueRef = useRef(q)
  const searchRevisionRef = useRef(0)
  const pendingSearchRef = useRef<{ value: string; revision: number } | null>(
    null
  )
  const [scannerRequested, setScannerRequested] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [localBrand, setLocalBrand] = useState(brand)
  const [localLine, setLocalLine] = useState(line)
  const [localOwnership, setLocalOwnership] = useState(
    tab === 'collection' ? 'owned' : ownership || 'all'
  )
  const [colorGroup, setColorGroup] = useState('')
  const lines = useMemo(() => {
    return Array.from(
      new Set(
        filterRows
          .filter((row) => !localBrand || row.brand === localBrand)
          .map((row) => row.line)
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [filterRows, localBrand])

  useEffect(() => {
    searchValueRef.current = searchValue
  }, [searchValue])

  const pushVaultParams = useCallback((nextValues?: {
    q?: string
    brand?: string
    line?: string
    ownership?: string
    matchHex?: string
    searchRevision?: number
  }) => {
    const params = new URLSearchParams()

    params.set('tab', tab)

    const nextQ = nextValues?.q ?? searchValue
    const nextBrand = nextValues?.brand ?? localBrand
    const nextLine = nextValues?.line ?? localLine
    const nextOwnership = nextValues?.ownership ?? localOwnership
    const nextMatchHex =
      nextValues && 'matchHex' in nextValues ? nextValues.matchHex : matchHex

    if (nextQ) params.set('q', nextQ)
    if (nextBrand) params.set('brand', nextBrand)
    if (nextLine) params.set('line', nextLine)
    if (tab === 'find' && nextMatchHex) params.set('matchHex', nextMatchHex)

    if (tab === 'find' && nextOwnership && nextOwnership !== 'all') {
      params.set('ownership', nextOwnership)
    }

    if (nextValues && 'q' in nextValues) {
      pendingSearchRef.current = {
        value: nextQ,
        revision: nextValues.searchRevision ?? searchRevisionRef.current,
      }
    }

    startTransition(() => {
      router.replace(`/vault?${params.toString()}`, { scroll: false })
    })
  }, [
    localBrand,
    localLine,
    localOwnership,
    matchHex,
    router,
    searchValue,
    startTransition,
    tab,
  ])

  const updateParam = useCallback(
    (key: string, value: string, searchRevision?: number) => {
      const nextQ = key === 'q' ? value : searchValue
      const nextBrand = key === 'brand' ? value : localBrand
      const nextLine =
        key === 'brand' ? '' : key === 'line' ? value : localLine
      const nextOwnership = key === 'ownership' ? value : localOwnership
      const nextMatchHex = key === 'q' ? '' : matchHex

      pushVaultParams({
        q: nextQ,
        brand: nextBrand,
        line: nextLine,
        ownership: nextOwnership,
        matchHex: nextMatchHex,
        searchRevision,
      })
    },
    [
      localBrand,
      localLine,
      localOwnership,
      matchHex,
      pushVaultParams,
      searchValue,
    ]
  )

  function updateSearchDraft(value: string) {
    searchRevisionRef.current += 1
    setSearchValue(value)
  }

  function handleBarcodeDetected(barcode: string) {
    const cleanedBarcode = barcode.replace(/\D/g, '')

    if (!cleanedBarcode) return

    searchRevisionRef.current += 1
    setSearchValue(cleanedBarcode)
    pushVaultParams({
      q: cleanedBarcode,
      matchHex: '',
      searchRevision: searchRevisionRef.current,
    })
  }

  function clearAllFilters() {
    searchRevisionRef.current += 1
    pendingSearchRef.current = null
    setSearchValue('')
    setLocalBrand('')
    setLocalLine('')
    setLocalOwnership('all')
    setColorGroup('')

    startTransition(() => {
      router.replace('/vault?tab=find', { scroll: false })
    })
  }

  function openScanner() {
    setScannerRequested(true)
    setScannerOpen(true)
  }

  useEffect(() => {
    const pendingSearch = pendingSearchRef.current

    if (
      pendingSearch &&
      pendingSearch.value === q &&
      pendingSearch.revision === searchRevisionRef.current
    ) {
      pendingSearchRef.current = null
      setSearchValue(q)
      return
    }

    if (!pendingSearch && q !== searchValueRef.current) {
      searchRevisionRef.current += 1
      setSearchValue(q)
    }
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
    const scheduledSearchValue = searchValue
    const scheduledRevision = searchRevisionRef.current

    const timeout = setTimeout(() => {
      if (scheduledSearchValue !== q) {
        updateParam('q', scheduledSearchValue, scheduledRevision)
      }
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchValue, q, updateParam])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
          <input
            value={searchValue}
            onChange={(event) => updateSearchDraft(event.target.value)}
            placeholder="Search by name, brand, line, or barcode"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </div>

        <button
          type="button"
          onClick={openScanner}
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

      {tab === 'find' ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <select
            value={colorGroup}
            onChange={(event) => setColorGroup(event.target.value)}
            className="min-w-0 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
          >
            <option value="" className="bg-slate-950 text-white">
              Color group
            </option>
            {COLOR_GROUP_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
                className="bg-slate-950 text-white"
              >
                {option}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ColorMatchModal
              selectedHex={matchHex}
              brand={localBrand}
              line={localLine}
              ownership={localOwnership}
            />

            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm font-semibold text-white/65 outline-none transition hover:border-white/20 hover:bg-slate-900 hover:text-white active:scale-95"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {scannerRequested ? (
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={handleBarcodeDetected}
        />
      ) : null}
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
