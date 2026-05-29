'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { createTheme } from './actions'

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

export default function ThemeForm({
  paints,
}: {
  paints: PaintOption[]
}) {
  const [selectedPaints, setSelectedPaints] = useState<(PaintOption | null)[]>(
    [null, null, null, null, null]
  )
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [catalogPaints, setCatalogPaints] = useState<PaintOption[]>(
    paints.filter((paint) => paint.source === 'catalog').slice(0, 80)
  )
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (activeSlot === null) return

    const controller = new AbortController()

    async function loadCatalogPaints() {
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

        if (!response.ok) {
          throw new Error('Paint search failed')
        }

        const result = await response.json()
        setCatalogPaints(result.paints || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error)
          setCatalogPaints([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }

    const timeout = window.setTimeout(loadCatalogPaints, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [activeSlot, query])

  const filteredPaints = useMemo(() => {
    const q = query.toLowerCase().trim()
    const customPaints = paints.filter((paint) => paint.source === 'custom')
    const matchingCustomPaints = q
      ? customPaints.filter((paint) =>
          `${paint.name} ${paint.brand || ''} ${paint.line || ''} ${
            paint.sku || ''
          }`
            .toLowerCase()
            .includes(q)
        )
      : customPaints.slice(0, 20)

    return [...catalogPaints, ...matchingCustomPaints].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [catalogPaints, paints, query])

  function choosePaint(paint: PaintOption) {
    if (activeSlot === null) return

    setSelectedPaints((current) =>
      current.map((item, index) => (index === activeSlot ? paint : item))
    )

    setActiveSlot(null)
    setQuery('')
  }

  return (
    <form action={createTheme} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Theme Name
        </label>

        <input
          type="text"
          name="name"
          required
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="Ghostly Ether"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Hero Image
        </label>

        <input
          type="file"
          name="image"
          accept="image/*"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Description
        </label>

        <textarea
          name="description"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="Describe the theme..."
        />
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-white">
          Palette Colors
        </label>

        <div className="grid grid-cols-5 gap-2">
          {selectedPaints.map((paint, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveSlot(index)}
              className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              {paint?.swatch_image_url ? (
                <Image
                  src={paint.swatch_image_url}
                  alt={paint.name}
                  fill
                  className="object-cover"
                />
              ) : paint?.hex ? (
                <div
                  className="h-full w-full"
                  style={{ backgroundColor: paint.hex }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl text-white/50">
                  +
                </span>
              )}

              <input
                type="hidden"
                name={`paint_source_${index}`}
                value={paint?.source || ''}
              />
              <input
                type="hidden"
                name={`paint_id_${index}`}
                value={paint?.id || ''}
              />
            </button>
          ))}
        </div>
      </div>

      {activeSlot !== null && (
        <div className="rounded-2xl border border-white/10 bg-[#10131a] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Choose Color {activeSlot + 1}
            </h3>

            <button
              type="button"
              onClick={() => setActiveSlot(null)}
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

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredPaints.map((paint) => (
              <button
                key={`${paint.source}-${paint.id}`}
                type="button"
                onClick={() => choosePaint(paint)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  {paint.swatch_image_url ? (
                    <Image
                      src={paint.swatch_image_url}
                      alt={paint.name}
                      fill
                      className="object-cover"
                    />
                  ) : paint.hex ? (
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: paint.hex }}
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {paint.name}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    {[paint.brand, paint.line, paint.sku]
                      .filter(Boolean)
                      .join(' / ')}
                  </p>
                </div>
              </button>
            ))}

            {!isSearching && filteredPaints.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                No paints found.
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-white">
          Tags
        </label>

        <input
          type="text"
          name="tags"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none"
          placeholder="nighthaunt, spectral, glowing"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black transition hover:bg-cyan-400"
      >
        Create Theme
      </button>
    </form>
  )
}
