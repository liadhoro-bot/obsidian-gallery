'use client'

import { useState } from 'react'
import Image from 'next/image'
import PrefetchLink from '../../../components/prefetch-link'

type ConversionPaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  is_owned: boolean | null
  is_wishlist: boolean | null
}

export default function PaintConversionChartGrid({
  initialPaints,
}: {
  initialPaints: ConversionPaint[]
}) {
  const [paints, setPaints] = useState(initialPaints)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  function toggleOwnership(paintId: string, action: 'owned' | 'wishlist') {
    const paint = paints.find((item) => item.id === paintId)
    if (!paint) return

    const previous = {
      is_owned: Boolean(paint.is_owned),
      is_wishlist: Boolean(paint.is_wishlist),
    }
    const currentValue =
      action === 'owned' ? Boolean(paint.is_owned) : Boolean(paint.is_wishlist)

    setPendingIds((prev) => new Set(prev).add(paintId))
    setPaints((prev) =>
      prev.map((item) => {
        if (item.id !== paintId) return item

        if (action === 'owned') {
          return { ...item, is_owned: !Boolean(item.is_owned) }
        }

        return { ...item, is_wishlist: !Boolean(item.is_wishlist) }
      })
    )

    ;(async () => {
      try {
        const res = await fetch('/api/vault/ownership', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paintId,
            action,
            currentValue,
          }),
        })

        if (!res.ok) throw new Error('Failed to update ownership')
      } catch {
        setPaints((prev) =>
          prev.map((item) => {
            if (item.id !== paintId) return item

            return {
              ...item,
              is_owned: previous.is_owned,
              is_wishlist: previous.is_wishlist,
            }
          })
        )
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(paintId)
          return next
        })
      }
    })()
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {paints.map((paint) => {
        const isBusy = pendingIds.has(paint.id)

        return (
          <article key={paint.id} className="min-w-0 space-y-2">
            <PrefetchLink
              href={`/vault/catalog/${paint.id}`}
              viewportPrefetch
              className="tap-card group block w-full text-left"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-[0_0_18px_rgba(0,0,0,0.45)] transition duration-150 group-hover:border-cyan-400/60">
                {paint.swatch_image_url ? (
                  <Image
                    src={paint.swatch_image_url}
                    alt={`${paint.name || 'Paint'} swatch`}
                    fill
                    className="object-cover transition duration-[180ms] group-hover:scale-[1.025]"
                    sizes="(max-width: 768px) 33vw, 150px"
                  />
                ) : paint.hex_approx ? (
                  <div
                    className="h-full w-full"
                    style={{ backgroundColor: paint.hex_approx }}
                  />
                ) : (
                  <div className="h-full w-full bg-slate-950" />
                )}
              </div>

              <h3 className="truncate text-sm font-black leading-tight text-white">
                {paint.name || 'Unnamed paint'}
              </h3>

              <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-300">
                {paint.brand || 'Unknown brand'}
              </p>

              <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
                {paint.line || 'No line'}
              </p>
            </PrefetchLink>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => toggleOwnership(paint.id, 'owned')}
                className={`micro-toggle flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight disabled:opacity-60 ${
                  paint.is_owned
                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]'
                    : 'border-white/10 bg-white/5 text-white/35'
                }`}
              >
                Owned
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => toggleOwnership(paint.id, 'wishlist')}
                className={`micro-toggle flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight disabled:opacity-60 ${
                  paint.is_wishlist
                    ? 'border-orange-400/30 bg-orange-400/10 text-orange-300'
                    : 'border-white/10 bg-white/5 text-white/35'
                }`}
              >
                Wishlist
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
