import { createClient } from '../../../../utils/supabase/server'
import PaintOwnershipControls from './paint-ownership-controls'

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
    </div>

    <PaintOwnershipControls
      paintId={paintRef.paintId}
      initialIsOwned={isOwned}
      initialIsWishlist={isWishlist}
      initialUnitsOwned={unitsOwned}
    />
  </section>
)
}