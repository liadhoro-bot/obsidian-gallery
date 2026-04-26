import { createClient } from '../../../../utils/supabase/server'
import { updatePaintOwnership } from './paint-actions'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintOwnershipCard({
  paintRef,
}: {
  paintRef: PaintRef
}) {
  if (paintRef.source === 'custom') {
    return null
  }

  const supabase = await createClient()

  const { data: ownership } = await supabase
    .from('user_paint_ownership')
    .select('is_owned, is_wishlist, units_owned')
    .eq('user_id', paintRef.userId)
    .eq('paint_catalog_id', paintRef.paintId)
    .maybeSingle()

  const isOwned = ownership?.is_owned ?? false
  const isWishlist = ownership?.is_wishlist ?? false
  const unitsOwned = ownership?.units_owned ?? 0

  return (
    <section className="rounded-2xl bg-slate-900/80 p-6 shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          Ownership
        </h2>

        <div className="flex gap-2">
          <OwnershipButton
  paintId={paintRef.paintId}
  action="owned"
  currentValue={isOwned}
  currentUnits={unitsOwned}
  label="Owned"
  activeClass="bg-cyan-500 text-slate-950"
/>

          <OwnershipButton
            paintId={paintRef.paintId}
            action="wishlist"
            currentValue={isWishlist}
            label="Wishlist"
            activeClass="bg-orange-400 text-slate-950"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          Units Owned
        </p>

        <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-slate-950">
          <CounterButton
            paintId={paintRef.paintId}
            action="decrement"
            currentUnits={unitsOwned}
            label="−"
          />

          <div className="flex items-center justify-center text-xl font-black text-white">
            {unitsOwned}
          </div>

          <CounterButton
            paintId={paintRef.paintId}
            action="increment"
            currentUnits={unitsOwned}
            label="+"
          />
        </div>
      </div>
    </section>
  )
}

function OwnershipButton({
  paintId,
  action,
  currentValue,
  currentUnits,
  label,
  activeClass,
}: {
  paintId: string
  action: 'owned' | 'wishlist'
  currentValue: boolean
  currentUnits: number 
  label: string
  activeClass: string
}) {
  return (
    <form action={updatePaintOwnership}>
      <input type="hidden" name="paintCatalogId" value={paintId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="currentValue" value={String(currentValue)} />
      <input type="hidden" name="currentUnits" value={currentUnits} />

      <button
        type="submit"
        className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
          currentValue
            ? activeClass
            : 'bg-slate-800 text-slate-400'
        }`}
      >
        {label}
      </button>
    </form>
  )
}

function CounterButton({
  paintId,
  action,
  currentUnits,
  label,
}: {
  paintId: string
  action: 'increment' | 'decrement'
  currentUnits: number
  label: string
}) {
  return (
    <form action={updatePaintOwnership}>
      <input type="hidden" name="paintCatalogId" value={paintId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="currentUnits" value={currentUnits} />

      <button
        type="submit"
        className="flex h-14 w-full items-center justify-center text-2xl font-black text-cyan-300"
      >
        {label}
      </button>
    </form>
  )
}