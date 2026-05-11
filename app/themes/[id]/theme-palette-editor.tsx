'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
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

const PAGE_SIZE = 200

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [isPending, startTransition] = useTransition()

  const allMatchingPaints = useMemo(() => {
    const q = query.trim().toLowerCase()

    return paintOptions
      .filter((paint) => {
        const searchable = [paint.name, paint.brand, paint.line, paint.sku]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return !q || searchable.includes(q)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [paintOptions, query])

  const filteredPaints = allMatchingPaints.slice(0, visibleCount)

  function openPicker(index: number) {
    if (!isOwner) return

    setActiveSlot(index)
    setQuery('')
    setVisibleCount(PAGE_SIZE)
  }

  function closePicker() {
    setActiveSlot(null)
    setQuery('')
    setVisibleCount(PAGE_SIZE)
  }

  function choosePaint(paint: PaintOption) {
    if (activeSlot === null) return

    startTransition(async () => {
      await setThemePaintSlot(themeId, activeSlot, paint.source, paint.id)
      closePicker()
      router.refresh()
    })
  }

  function renderSwatch(slot: PaletteSlot, index: number) {
    return (
      <>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {slot?.imageUrl ? (
            <Image
              src={slot.imageUrl}
              alt={slot.name}
              fill
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
          if (!slot) {
            return (
              <button
                key={index}
                type="button"
                disabled={!isOwner}
                onClick={() => openPicker(index)}
                className="space-y-2 disabled:cursor-default"
              >
                {renderSwatch(slot, index)}
              </button>
            )
          }

          if (mode === 'edit') {
            return (
              <button
                key={slot.id}
                type="button"
                disabled={!isOwner}
                onClick={() => openPicker(index)}
                className="space-y-2 disabled:cursor-default"
              >
                {renderSwatch(slot, index)}
              </button>
            )
          }

          const href =
            slot.paintSource === 'catalog'
              ? `/vault/catalog/${slot.paintId}`
              : `/vault/custom/${slot.paintId}`

          return (
            <Link key={slot.id} href={href} className="space-y-2">
              {renderSwatch(slot, index)}
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
              onChange={(event) => {
                setQuery(event.target.value)
                setVisibleCount(PAGE_SIZE)
              }}
              placeholder="Search by name, brand, line, or SKU..."
              className="mb-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
            />

            <p className="mb-3 text-xs text-white/35">
              Showing {filteredPaints.length} of {allMatchingPaints.length}{' '}
              matching paints
            </p>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {filteredPaints.map((paint) => (
                <button
                  key={`${paint.source}-${paint.id}`}
                  type="button"
                  disabled={isPending}
                  onClick={() => choosePaint(paint)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06] disabled:opacity-50"
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

              {filteredPaints.length < allMatchingPaints.length && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) => current + PAGE_SIZE)
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/[0.07]"
                >
                  Load more colors
                </button>
              )}

              {filteredPaints.length === 0 && (
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