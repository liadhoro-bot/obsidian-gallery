'use client'

import { useOptimistic, useTransition } from 'react'
import { updatePaintOwnership } from './paint-actions'

type OwnershipState = {
  isOwned: boolean
  isWishlist: boolean
  unitsOwned: number
}

export default function PaintOwnershipControls({
  paintId,
  initialIsOwned,
  initialIsWishlist,
  initialUnitsOwned,
}: {
  paintId: string
  initialIsOwned: boolean
  initialIsWishlist: boolean
  initialUnitsOwned: number
}) {
  const [isPending, startTransition] = useTransition()

  const [optimistic, setOptimistic] = useOptimistic<
    OwnershipState,
    OwnershipState
  >(
    {
      isOwned: initialIsOwned,
      isWishlist: initialIsWishlist,
      unitsOwned: initialUnitsOwned,
    },
    (_, nextState) => nextState
  )

  function runAction(action: 'owned' | 'wishlist' | 'increment' | 'decrement') {
    let nextState = { ...optimistic }

    if (action === 'owned') {
      const nextOwned = !optimistic.isOwned
      nextState.isOwned = nextOwned
      nextState.unitsOwned = nextOwned ? Math.max(1, optimistic.unitsOwned) : 0
    }

    if (action === 'wishlist') {
      nextState.isWishlist = !optimistic.isWishlist
    }

    if (action === 'increment') {
      const nextUnits = optimistic.unitsOwned + 1
      nextState.unitsOwned = nextUnits
      nextState.isOwned = nextUnits > 0
    }

    if (action === 'decrement') {
      const nextUnits = Math.max(0, optimistic.unitsOwned - 1)
      nextState.unitsOwned = nextUnits
      nextState.isOwned = nextUnits > 0
    }

    setOptimistic(nextState)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('paintCatalogId', paintId)
      formData.set('action', action)
      formData.set('currentValue', String(
        action === 'owned' ? optimistic.isOwned : optimistic.isWishlist
      ))
      formData.set('currentUnits', String(optimistic.unitsOwned))

      await updatePaintOwnership(formData)
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => runAction('owned')}
          disabled={isPending}
          className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            optimistic.isOwned
              ? 'bg-cyan-400 text-slate-950'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Owned
        </button>

        <button
          type="button"
          onClick={() => runAction('wishlist')}
          disabled={isPending}
          className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${
            optimistic.isWishlist
              ? 'bg-orange-400 text-slate-950'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Wishlist
        </button>
      </div>

      <div>
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          Units Owned
        </p>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-slate-950">
          <button
            type="button"
            onClick={() => runAction('decrement')}
            disabled={isPending}
            className="flex h-14 w-full items-center justify-center text-2xl font-black text-cyan-300 transition disabled:opacity-50"
          >
            −
          </button>

          <div className="flex items-center justify-center text-xl font-black text-white">
            {optimistic.unitsOwned}
          </div>

          <button
            type="button"
            onClick={() => runAction('increment')}
            disabled={isPending}
            className="flex h-14 w-full items-center justify-center text-2xl font-black text-cyan-300 transition disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </>
  )
}