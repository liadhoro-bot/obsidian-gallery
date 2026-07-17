'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import PrefetchLink from '../components/prefetch-link'

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

function isUsableColorHex(hex: string | null | undefined): hex is string {
  return Boolean(hex && /^#[0-9A-Fa-f]{6}$/.test(hex))
}

function colorDistance(hexA: string, hexB: string) {
  const cleanA = hexA.replace('#', '')
  const cleanB = hexB.replace('#', '')
  const a = {
    r: parseInt(cleanA.slice(0, 2), 16),
    g: parseInt(cleanA.slice(2, 4), 16),
    b: parseInt(cleanA.slice(4, 6), 16),
  }
  const b = {
    r: parseInt(cleanB.slice(0, 2), 16),
    g: parseInt(cleanB.slice(2, 4), 16),
    b: parseInt(cleanB.slice(4, 6), 16),
  }

  return Math.sqrt(
    Math.pow(a.r - b.r, 2) +
      Math.pow(a.g - b.g, 2) +
      Math.pow(a.b - b.b, 2)
  )
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

type VaultFilterPreview = {
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  tab: 'find' | 'collection'
}

function shouldKeepVisible({
  nextPaint,
  tab,
  ownership,
}: {
  nextPaint: VaultPaint
  tab: 'find' | 'collection'
  ownership: string
}) {
  if (nextPaint.source === 'custom') {
    return tab === 'collection' || ownership === 'all' || ownership === 'custom'
  }

  if (tab === 'collection') {
    return nextPaint.is_owned
  }

  if (ownership === 'owned') {
    return nextPaint.is_owned
  }

  if (ownership === 'wishlist') {
    return nextPaint.is_wishlist
  }

  if (ownership === 'unowned') {
    return !nextPaint.is_owned
  }

  if (ownership === 'custom') {
    return false
  }

  return true
}

export default function VaultGridClient({
  initialPaints,
  tab,
  q,
  brand,
  line,
  ownership,
  matchHex,
  hasMore,
}: {
  initialPaints: VaultPaint[]
  tab: 'find' | 'collection'
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  hasMore: boolean
}) {
  const [paints, setPaints] = useState(initialPaints)
  const [loading, setLoading] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [optimisticPreview, setOptimisticPreview] = useState<VaultFilterPreview>({
    q,
    brand,
    line,
    ownership,
    matchHex,
    tab,
  })

  useEffect(() => {
    setPaints(initialPaints)
    setPendingIds(new Set())
    setLoading(false)
    setOptimisticPreview({
      q,
      brand,
      line,
      ownership,
      matchHex,
      tab,
    })
  }, [brand, initialPaints, line, matchHex, ownership, q, tab])

  useEffect(() => {
    function handleFilterPreview(event: Event) {
      const detail = (event as CustomEvent<VaultFilterPreview>).detail
      if (!detail) return

      setOptimisticPreview(detail)
    }

    window.addEventListener('vault:filters-preview', handleFilterPreview)

    return () => {
      window.removeEventListener('vault:filters-preview', handleFilterPreview)
    }
  }, [])

  async function loadMore() {
    setLoading(true)

    const params = new URLSearchParams()
    params.set('q', q)
    params.set('brand', brand)
    params.set('line', line)
    params.set('ownership', ownership)
    params.set('tab', tab)
    params.set('matchHex', matchHex)
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

  useEffect(() => {
    function handleBatchUpdate(event: Event) {
      const detail = (event as CustomEvent<{
        paintIds?: string[]
        mode?: 'owned' | 'wishlist' | 'remove-owned'
      }>).detail
      const paintIds = new Set(detail?.paintIds ?? [])

      if (!paintIds.size || !detail?.mode) return

      setPaints((prev) =>
        prev
          .map((paint) => {
          if (paint.source !== 'catalog' || !paintIds.has(paint.id)) {
            return paint
          }

          if (detail.mode === 'wishlist') {
            return { ...paint, is_wishlist: true }
          }

          if (detail.mode === 'remove-owned') {
            return { ...paint, is_owned: false }
          }

          return { ...paint, is_owned: true, is_wishlist: false }
          })
          .filter((paint) =>
            shouldKeepVisible({
              nextPaint: paint,
              tab,
              ownership,
            })
          )
      )
    }

    window.addEventListener('vault:batch-ownership-updated', handleBatchUpdate)

    return () => {
      window.removeEventListener(
        'vault:batch-ownership-updated',
        handleBatchUpdate
      )
    }
  }, [ownership, tab])

  const isReconciling =
    optimisticPreview.q !== q ||
    optimisticPreview.brand !== brand ||
    optimisticPreview.line !== line ||
    optimisticPreview.ownership !== ownership ||
    optimisticPreview.matchHex !== matchHex ||
    optimisticPreview.tab !== tab

  const visiblePaints = useMemo(() => {
    const basePaints = paints.filter((paint) => {
      if (
        optimisticPreview.tab === 'collection' &&
        !shouldKeepVisible({
          nextPaint: paint,
          tab: 'collection',
          ownership: 'owned',
        })
      ) {
        return false
      }

      if (
        optimisticPreview.tab === 'find' &&
        !shouldKeepVisible({
          nextPaint: paint,
          tab: 'find',
          ownership: optimisticPreview.ownership,
        })
      ) {
        return false
      }

      if (
        optimisticPreview.brand &&
        (paint.brand || '') !== optimisticPreview.brand
      ) {
        return false
      }

      if (
        optimisticPreview.line &&
        (paint.line || '') !== optimisticPreview.line
      ) {
        return false
      }

      const query = optimisticPreview.q.trim().toLowerCase()
      if (query) {
        const haystack = [
          paint.name,
          paint.brand,
          paint.line,
          paint.sku,
          paint.hex_approx,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(query)) {
          return false
        }
      }

      return true
    })

    if (!isUsableColorHex(optimisticPreview.matchHex)) {
      return basePaints
    }

    return [...basePaints]
      .filter(
        (paint): paint is VaultPaint & { source: 'catalog'; hex_approx: string } =>
          paint.source === 'catalog' && isUsableColorHex(paint.hex_approx)
      )
      .sort(
        (a, b) =>
          colorDistance(optimisticPreview.matchHex, a.hex_approx) -
          colorDistance(optimisticPreview.matchHex, b.hex_approx)
      )
      .slice(0, 24)
  }, [optimisticPreview, paints])

  function toggleOwnership(paintId: string, action: 'owned' | 'wishlist') {
    const paint = paints.find((p) => p.id === paintId)
    if (!paint) return
    const previousPaints = paints

    const previous = {
      is_owned: paint.is_owned,
      is_wishlist: paint.is_wishlist,
    }

    const currentValue =
      action === 'owned' ? paint.is_owned : paint.is_wishlist

    setPendingIds((prev) => new Set(prev).add(paintId))

    setPaints((prev) =>
      prev
        .map((p) => {
        if (p.id !== paintId) return p

        if (action === 'owned') {
          return { ...p, is_owned: !p.is_owned }
        }

        return { ...p, is_wishlist: !p.is_wishlist }
        })
        .filter((paint) =>
          shouldKeepVisible({
            nextPaint: paint,
            tab,
            ownership,
          })
        )
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
        setPaints(
          previousPaints.map((p) =>
            p.id !== paintId
              ? p
              : {
                  ...p,
                  is_owned: previous.is_owned,
                  is_wishlist: previous.is_wishlist,
                }
          )
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
        {visiblePaints.map((paint) => {
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
              <PrefetchLink href={href} className="tap-card group block w-full text-left">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-[0_0_18px_rgba(0,0,0,0.6)] transition duration-150 group-hover:border-cyan-400/60">
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
                      className="object-cover transition duration-[180ms] group-hover:scale-[1.025]"
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

      {hasMore && !isReconciling ? (
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="tap-press tap-target inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          <span>{loading ? 'Loading...' : 'Load more'}</span>
        </button>
      </div>
      ) : null}
    </section>
  )
}
