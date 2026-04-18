import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

export default async function DashboardRecentUnits() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: units, error } = await supabase
    .from('units')
    .select(`
      id,
      name,
      complexity,
      unit_size,
      is_active,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Recent Units</h2>
        <p className="mt-3 text-sm text-red-300">Could not load units.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Units</h2>
      </div>

      <div className="mt-4 space-y-3">
        {units?.length ? (
          units.map((unit) => (
            <Link
              key={unit.id}
              href={`/units/${unit.id}`}
              className="block rounded-xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{unit.name}</p>
                  <p className="mt-1 text-xs text-white/50">
                    {unit.complexity ?? '—'} · {unit.unit_size ?? '—'}
                  </p>
                </div>

                {unit.is_active ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs text-emerald-300">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/60">
                    Inactive
                  </span>
                )}
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-white/60">No units yet.</p>
        )}
      </div>
    </section>
  )
}