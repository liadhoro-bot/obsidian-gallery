'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  countFilteredPaints,
  markFilteredPaintsOwned,
  markFilteredPaintsWishlist,
  markPaintSetOwned,
  removeFilteredPaintsOwned,
  searchPaintSets,
} from './batch-actions'

type PaintSetResult = Awaited<ReturnType<typeof searchPaintSets>>[number]
type BatchMode = 'owned' | 'wishlist' | 'remove-owned'
type VaultBatchFilters = {
  q?: string
  brand?: string
  line?: string
  ownership?: string
  matchHex?: string
  tab?: 'find' | 'collection'
}

type Props = {
  tab: 'find' | 'collection'
  q: string
  brand: string
  line: string
  ownership: string
  matchHex?: string
}

function dispatchBatchUpdate(paintIds: string[], mode: BatchMode) {
  window.dispatchEvent(
    new CustomEvent('vault:batch-ownership-updated', {
      detail: { paintIds, mode },
    })
  )
}

export default function VaultBatchActions({
  tab,
  q,
  brand,
  line,
  ownership,
  matchHex = '',
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [setModalOpen, setSetModalOpen] = useState(false)
  const [setQuery, setSetQuery] = useState('')
  const [paintSets, setPaintSets] = useState<PaintSetResult[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const filters: VaultBatchFilters = {
    tab,
    q,
    brand,
    line,
    ownership,
    matchHex,
  }

  useEffect(() => {
    if (!message && !error) return

    const timeout = setTimeout(() => {
      setMessage('')
      setError('')
    }, 3200)

    return () => clearTimeout(timeout)
  }, [message, error])

  useEffect(() => {
    if (!setModalOpen) return

    let cancelled = false

    startTransition(async () => {
      try {
        const results = await searchPaintSets(setQuery, brand, line)
        if (!cancelled) setPaintSets(results)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load paint sets.'
          )
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [brand, line, setModalOpen, setQuery])

  function runFilteredAction(mode: BatchMode) {
    setMenuOpen(false)

    startTransition(async () => {
      try {
        setError('')
        const count = await countFilteredPaints(filters)

        if (count === 0) {
          setMessage('No matching catalog paints found.')
          return
        }

        const actionLabel =
          mode === 'owned'
            ? 'mark as owned'
            : mode === 'wishlist'
              ? 'mark as wishlist'
              : 'remove from owned'
        const warning =
          count > 100
            ? `\n\nThis is a large batch. Review your filters before continuing.`
            : ''

        if (
          !window.confirm(
            `This will ${actionLabel} ${count} paints in the current filtered view.${warning}`
          )
        ) {
          return
        }

        const result =
          mode === 'owned'
            ? await markFilteredPaintsOwned(filters)
            : mode === 'wishlist'
              ? await markFilteredPaintsWishlist(filters)
              : await removeFilteredPaintsOwned(filters)

        dispatchBatchUpdate(result.paint_ids, mode)
        setMessage(
          mode === 'owned'
            ? `${result.paint_count} paints marked as owned.`
            : mode === 'wishlist'
              ? 'Current filtered view marked as wishlist.'
              : `${result.paint_count} paints removed from owned.`
        )
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Batch action failed.'
        )
      }
    })
  }

  function runPaintSetAction(paintSet: PaintSetResult) {
    startTransition(async () => {
      try {
        setError('')

        if (
          paintSet.paint_count > 10 &&
          !window.confirm(
            `This will mark ${paintSet.paint_count} paints from ${paintSet.name} as owned.`
          )
        ) {
          return
        }

        const result = await markPaintSetOwned(paintSet.id)
        dispatchBatchUpdate(result.paint_ids, 'owned')
        setMessage(`${result.paint_count} paints marked as owned.`)
        setSetModalOpen(false)
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : 'Could not mark this set as owned.'
        )
      }
    })
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/75 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100 disabled:opacity-60 sm:px-4"
        >
          {isPending ? 'Working' : 'Batch Actions'}
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.16)]">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setSetModalOpen(true)
              }}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-white hover:bg-cyan-300/10"
            >
              Add Paint Set
            </button>
            <button
              type="button"
              onClick={() => runFilteredAction('owned')}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-white hover:bg-cyan-300/10"
            >
              Mark current results as Owned
            </button>
            <button
              type="button"
              onClick={() => runFilteredAction('wishlist')}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-white hover:bg-cyan-300/10"
            >
              Mark current results as Wishlist
            </button>
            <button
              type="button"
              onClick={() => runFilteredAction('remove-owned')}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-red-200 hover:bg-red-400/10"
            >
              Remove current results from Owned
            </button>
          </div>
        ) : null}
      </div>

      {setModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-black/70 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-paint-set-title"
        >
          <div className="max-h-[calc(100dvh-6rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-[0_0_40px_rgba(34,211,238,0.18)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="vault-paint-set-title"
                  className="text-lg font-black text-white"
                >
                  Add Paint Set
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Find a seeded set and mark every catalog paint in it as owned.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSetModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg leading-none text-white/70"
                aria-label="Close paint set search"
              >
                x
              </button>
            </div>

            <input
              value={setQuery}
              onChange={(event) => setSetQuery(event.target.value)}
              placeholder="Search paint sets"
              className="mt-5 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-400/60"
            />

            <div className="mt-5 space-y-3">
              {paintSets.length === 0 && !isPending ? (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center text-sm font-semibold text-white/55">
                  No paint sets found yet.
                </p>
              ) : null}

              {paintSets.map((paintSet) => (
                <article
                  key={paintSet.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-white">
                        {paintSet.name}
                      </h3>
                      <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
                        {paintSet.brand}
                        {paintSet.line ? ` / ${paintSet.line}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">
                      {paintSet.owned_count}/{paintSet.paint_count}
                    </span>
                  </div>

                  {paintSet.description ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/55">
                      {paintSet.description}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => runPaintSetAction(paintSet)}
                    disabled={isPending || paintSet.paint_count === 0}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950 disabled:opacity-60"
                  >
                    Mark set as owned
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {message || error ? (
        <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-cyan-400/20 bg-slate-950/95 px-5 py-3 text-center text-sm font-semibold text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.18)] backdrop-blur">
          {error || message}
        </div>
      ) : null}
    </>
  )
}
