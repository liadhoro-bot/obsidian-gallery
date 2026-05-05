'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const PAGE_SIZE = 24

function getBrandAbbreviation(brand?: string | null) {
  const normalized = (brand || '').toLowerCase()

  if (normalized.includes('vallejo')) return 'VAL'
  if (normalized.includes('warhammer')) return 'WHC'
  if (normalized.includes('citadel')) return 'WHC'
  if (normalized.includes('army painter')) return 'TAP'
  if (normalized.includes('custom')) return 'CUS'

  return (brand || 'UNK').slice(0, 3).toUpperCase()
}

type VaultPaint = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  paint_type: string | null
  is_owned: boolean
  is_wishlist: boolean
}

export default function VaultGridClient({
  initialPaints,
  q,
  brand,
  line,
  ownership,
}: {
  initialPaints: VaultPaint[]
  q: string
  brand: string
  line: string
  ownership: string
}) {
  const [paints, setPaints] = useState(initialPaints)
  const [loading, setLoading] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  async function loadMore() {
    setLoading(true)

    const params = new URLSearchParams()
    params.set('q', q)
    params.set('brand', brand)
    params.set('line', line)
    params.set('ownership', ownership)
    params.set('from', String(paints.length))
    params.set('to', String(paints.length + PAGE_SIZE - 1))

    try {
      const res = await fetch(`/api/vault?${params.toString()}`)
      const json = await res.json()

      setPaints((prev) => [...prev, ...(json.paints ?? [])])
    } finally {
      setLoading(false)
    }
  }

  function toggleOwnership(paintId: string, action: 'owned' | 'wishlist') {
    const paint = paints.find((p) => p.id === paintId)
    if (!paint) return

    const previous = {
      is_owned: paint.is_owned,
      is_wishlist: paint.is_wishlist,
    }

    const currentValue =
      action === 'owned' ? paint.is_owned : paint.is_wishlist

    setPendingIds((prev) => new Set(prev).add(paintId))

    setPaints((prev) =>
      prev.map((p) => {
        if (p.id !== paintId) return p

        if (action === 'owned') {
          return { ...p, is_owned: !p.is_owned }
        }

        return { ...p, is_wishlist: !p.is_wishlist }
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
          prev.map((p) => {
            if (p.id !== paintId) return p

            return {
              ...p,
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
    <section className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {paints.map((paint) => {
          const href =
            paint.source === 'custom'
              ? `/vault/custom/${paint.id}`
              : `/vault/catalog/${paint.id}`

          const isBusy = pendingIds.has(paint.id)

          return (
            <article
  key={`${paint.source}-${paint.id}`}
  className="min-w-0 space-y-2"
>
              <Link href={href} className="group block w-full text-left">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-[0_0_18px_rgba(0,0,0,0.6)] transition group-hover:border-cyan-400/60">
                {paint.source === 'custom' && (
  <span className="absolute left-2 top-2 z-10 rounded-md bg-cyan-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-300">
    Custom
  </span>
)}
                  {paint.swatch_image_url ? (
                    <Image
                      src={paint.swatch_image_url}
                      alt={`${paint.name || 'Paint'} swatch`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 220px"
                    />
                  ) : paint.hex_approx ? (
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: paint.hex_approx }}
                    />
                  ) : (
                    <div className="h-full w-full bg-neutral-900" />
                  )}
                </div>

                <h3 className="truncate text-sm font-black leading-tight text-white">
                  {paint.name || 'Unnamed paint'}
                </h3>

                <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
                  <span className="text-cyan-300">
  {getBrandAbbreviation(paint.brand)}
</span>
<span className="text-white/25"> · </span>
<span>{paint.line || 'No line'}</span>
                </p>
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => toggleOwnership(paint.id, 'owned')}
                  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight transition-all duration-150 active:scale-95 disabled:opacity-60 ${
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
                  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight transition-all duration-150 active:scale-95 disabled:opacity-60 ${
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

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="rounded-full bg-cyan-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      </div>
    </section>
  )
}