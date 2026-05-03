'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const PAGE_SIZE = 24

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
  const [isPending, startTransition] = useTransition()

  async function loadMore() {
    setLoading(true)

    const params = new URLSearchParams()
    params.set('q', q)
    params.set('brand', brand)
    params.set('line', line)
    params.set('ownership', ownership)
    params.set('from', String(paints.length))
    params.set('to', String(paints.length + PAGE_SIZE - 1))

    const res = await fetch(`/api/vault?${params.toString()}`)
    const json = await res.json()

    setPaints((prev) => [...prev, ...json.paints])
    setLoading(false)
  }
function toggleOwnership(paintId: string, action: 'owned' | 'wishlist') {
  const paint = paints.find((p) => p.id === paintId)
  if (!paint) return

  const currentValue =
    action === 'owned' ? paint.is_owned : paint.is_wishlist

  setPaints((prev) =>
    prev.map((p) => {
      if (p.id !== paintId) return p

      if (action === 'owned') {
        return {
          ...p,
          is_owned: !p.is_owned,
        }
      }

      return {
        ...p,
        is_wishlist: !p.is_wishlist,
      }
    })
  )

  startTransition(async () => {
    await fetch('/api/vault/ownership', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paintId,
        action,
        currentValue,
      }),
    })
  })
}
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-3 gap-x-4 gap-y-7">
        {paints.map((paint) => {
          const href =
            paint.source === 'custom'
              ? `/vault/custom/${paint.id}`
              : `/vault/catalog/${paint.id}`

          return (
            <article key={`${paint.source}-${paint.id}`} className="min-w-0">
              <Link href={href} className="group block w-full text-left">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-[0_0_0_4px_rgba(23,23,23,0.65)] transition group-hover:border-cyan-500">
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

                <h3 className="mt-3 truncate text-xs font-black uppercase leading-tight tracking-wide text-white">
                  {paint.name || 'Unnamed paint'}
                </h3>

                <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
                  <span>{paint.brand || 'Unknown'}</span>
                  <span className="text-neutral-600"> · </span>
                  <span>{paint.line || 'No line'}</span>
                </p>
              </Link>
              <div className="mt-2 grid grid-cols-2 gap-1">
  <button
  type="button"
  disabled={isPending}
  onClick={() => toggleOwnership(paint.id, 'owned')}
  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight transition disabled:opacity-60 ${
    paint.is_owned
      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
      : 'border-neutral-700 bg-neutral-800 text-neutral-500'
  }`}
>
  Owned
</button>

  <button
  type="button"
  disabled={isPending}
  onClick={() => toggleOwnership(paint.id, 'wishlist')}
  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight transition disabled:opacity-60 ${
    paint.is_wishlist
      ? 'border-orange-500/20 bg-orange-500/10 text-orange-300'
      : 'border-neutral-700 bg-neutral-800 text-neutral-500'
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
          className="rounded-full bg-cyan-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 disabled:opacity-60"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      </div>
    </section>
  )
}