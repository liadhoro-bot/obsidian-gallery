'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setThemePaintSlot } from './actions'

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

type PaletteSlot = {
  id: string
  paintId: string
  paintSource: 'catalog' | 'custom'
  name: string
  imageUrl: string | null
  hex: string | null
} | null

export default function ThemePaletteEditor({
  themeId,
  isOwner,
  slots,
  paintOptions,
  mode = 'display',
}: {
  themeId: string
  isOwner: boolean
  slots: PaletteSlot[]
  paintOptions: PaintOption[]
  mode?: 'display' | 'edit'
}) {
  const router = useRouter()

  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [remotePaints, setRemotePaints] = useState<PaintOption[]>(paintOptions)
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

        if (!response.ok) {
          throw new Error('Paint search failed')
        }

        const result = await response.json()
        setRemotePaints(result.paints || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(error)
          setRemotePaints([])
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
    return [...remotePaints].sort((a, b) => a.name.localeCompare(b.name))
  }, [remotePaints])

  function openPicker(index: number) {
    if (!isOwner) return

    setActiveSlot(index)
    setQuery('')
  }

  function closePicker() {
    setActiveSlot(null)
    setQuery('')
  }

  function choosePaint(paint: PaintOption) {
    if (activeSlot === null) return

    startTransition(async () => {
      await setThemePaintSlot(themeId, activeSlot, paint.source, paint.id)
      closePicker()
      router.refresh()
    })
  }

  function renderSwatch(slot: PaletteSlot) {
    return (
      <>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {slot?.imageUrl ? (
            <Image
              src={slot.imageUrl}
              alt={slot.name}
              fill
              sizes="20vw"
              className="object-cover"
            />
          ) : slot?.hex ? (
            <div
              className="h-full w-full"
              style={{ backgroundColor: slot.hex }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-light text-white/25">
              +
            </div>
          )}
        </div>

        <p className="line-clamp-2 text-center text-[10px] leading-tight text-white/50">
          {slot?.name || 'Empty'}
        </p>
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {slots.map((slot, index) => {
          if (!slot || mode === 'edit') {
            return (
              <button
                key={slot?.id || index}
                type="button"
                disabled={!isOwner}
                onClick={() => openPicker(index)}
                className="space-y-2 disabled:cursor-default"
              >
                {renderSwatch(slot)}
              </button>
            )
          }

          const href =
            slot.paintSource === 'catalog'
              ? `/vault/catalog/${slot.paintId}`
              : `/vault/custom/${slot.paintId}`

          return (
            <Link key={slot.id} href={href} className="space-y-2">
              {renderSwatch(slot)}
            </Link>
          )
        })}
      </div>

      {activeSlot !== null && (
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
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                    {paint.swatch_image_url ? (
                      <Image
                        src={paint.swatch_image_url}
                        alt={paint.name}
                        fill
                        sizes="40px"
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

                  {isPending ? (
                    <span className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent text-white/70" />
                  ) : null}
                </button>
              ))}

              {!isSearching && filteredPaints.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                  No paints found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
