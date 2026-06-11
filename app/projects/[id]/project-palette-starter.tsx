'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { setProjectPaletteSlot } from './actions'
import { setUnitPaletteSlot } from '../../units/[id]/actions'

type PaintOption = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  sku?: string | null
  swatch_image_url: string | null
  hex: string | null
}

type Props = {
  projectId?: string
  unitId?: string
  slotIndex?: number
}

export default function ProjectPaletteStarter({
  projectId,
  unitId,
  slotIndex,
}: Props) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [paints, setPaints] = useState<PaintOption[]>([])
  const [selectedPaints, setSelectedPaints] = useState<Record<number, PaintOption>>({})
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (activeSlot === null) return

    const controller = new AbortController()

    async function loadPaints() {
      setIsSearching(true)

      try {
        const params = new URLSearchParams()
        params.set('limit', '80')

        if (query.trim()) {
          params.set('q', query.trim())
        }

        const response = await fetch(
          `/api/theme-paint-search?${params.toString()}`,
          { signal: controller.signal }
        )

        const result = await response.json()
        setPaints(result.paints || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error)
          setPaints([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }

    const timeout = window.setTimeout(loadPaints, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [activeSlot, query])

  const filteredPaints = useMemo(() => {
    return [...paints].sort((a, b) => a.name.localeCompare(b.name))
  }, [paints])

  function closePicker() {
    setActiveSlot(null)
    setQuery('')
  }

  function choosePaint(paint: PaintOption) {
    if (activeSlot === null) return

    const slot = activeSlot
    const previousPaints = selectedPaints

    setError('')
    setSelectedPaints((current) => ({ ...current, [slot]: paint }))
    closePicker()

    startTransition(async () => {
      try {
        if (unitId) {
          await setUnitPaletteSlot(unitId, slot, paint.source, paint.id)
        } else if (projectId) {
          await setProjectPaletteSlot(projectId, slot, paint.source, paint.id)
        }
      } catch (slotError) {
        setSelectedPaints(previousPaints)
        setError(
          slotError instanceof Error
            ? slotError.message
            : 'Could not update palette.'
        )
      }
    })
  }

  return (
    <>
      <div className={slotIndex === undefined ? 'grid grid-cols-5 gap-2' : ''}>
        {Array.from({ length: slotIndex === undefined ? 5 : 1 }).map(
          (_, localIndex) => {
            const index = slotIndex ?? localIndex
            const selectedPaint = selectedPaints[index]

            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setActiveSlot(index)
                  setQuery('')
                }}
                className="flex aspect-square w-full min-w-0 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] text-lg font-semibold text-white/30 transition hover:border-cyan-400/50 hover:text-cyan-300 active:scale-95"
              >
                {selectedPaint ? (
                  selectedPaint.swatch_image_url ? (
                    <Image
                      src={selectedPaint.swatch_image_url}
                      alt={selectedPaint.name}
                      width={96}
                      height={96}
                      sizes="64px"
                      className="h-full w-full rounded-xl object-cover"
                    />
                  ) : (
                    <span
                      className="h-full w-full rounded-xl"
                      style={{ backgroundColor: selectedPaint.hex || '#262626' }}
                    />
                  )
                ) : (
                  '+'
                )}
              </button>
            )
          }
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {activeSlot !== null ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 sm:items-center">
          <div className="mx-auto max-h-[80vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#10131a] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Choose Color {activeSlot + 1}
              </h3>

              <button
                type="button"
                onClick={closePicker}
                className="text-sm text-white/50"
              >
                Close
              </button>
            </div>

            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, brand, line, or SKU..."
              className="mb-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
            />

            <p className="mb-3 text-xs text-white/35">
              {isSearching
                ? 'Searching paints...'
                : `Showing ${filteredPaints.length} matching paints`}
            </p>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {filteredPaints.map((paint) => (
                <button
                  key={`${paint.source}-${paint.id}`}
                  type="button"
                  disabled={isPending}
                  onClick={() => choosePaint(paint)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:bg-neutral-700/70 disabled:text-white/60 disabled:opacity-70"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {paint.swatch_image_url ? (
                      <Image
                        src={paint.swatch_image_url}
                        alt={paint.name}
                        width={40}
                        height={40}
                        sizes="40px"
                        className="h-full w-full object-cover"
                      />
                    ) : paint.hex ? (
                      <div
                        className="h-full w-full"
                        style={{ backgroundColor: paint.hex }}
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {paint.name}
                    </p>
                    <p className="truncate text-xs text-white/40">
                      {[paint.brand, paint.line, paint.sku]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  {isPending ? (
                    <span className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent text-white/70" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
