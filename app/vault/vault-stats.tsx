import { createClient } from '../../utils/supabase/server'

export default async function VaultStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [{ count: totalPaints }, { data: ownedRows }] = await Promise.all([
    supabase
      .from('paint_catalog')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id')
      .eq('user_id', user.id)
      .eq('is_owned', true),
  ])

  const ownedCount = ownedRows?.length || 0
  const total = totalPaints || 0
  const missingCount = Math.max(0, total - ownedCount)

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Catalogue
        </p>
        <p className="mt-2 text-2xl font-bold text-white">{total}</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Owned
        </p>
        <p className="mt-2 text-2xl font-bold text-white">{ownedCount}</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Missing
        </p>
        <p className="mt-2 text-2xl font-bold text-white">{missingCount}</p>
      </div>
    </section>
  )
}