import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

type UnitImageRow = {
  entity_id: string
  image_url: string
}

export default async function DashboardUnitInProgress() {
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
      updated_at,
      project_id
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(12)

  if (error || !units?.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">No unit in progress yet.</p>
      </section>
    )
  }

  const unitIds = units.map((unit) => unit.id)

  const { data: doneRows } = await supabase
    .from('unit_stage_progress')
    .select('unit_id, is_done')
    .in('unit_id', unitIds)
    .eq('stage_key', 'done')

  const doneMap = new Map<string, boolean>()

  for (const row of doneRows ?? []) {
    doneMap.set(row.unit_id, row.is_done === true)
  }

  const inProgressUnit =
    units.find((unit) => doneMap.get(unit.id) !== true) ?? null

  if (!inProgressUnit) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Unit in Progress
        </p>
        <p className="mt-4 text-sm text-white/60">
          All tracked units are currently complete.
        </p>
      </section>
    )
  }

  const { data: featuredImage } = await supabase
    .from('image_assets')
    .select('entity_id, image_url')
    .eq('entity_type', 'unit')
    .eq('entity_id', inProgressUnit.id)
    .eq('is_featured', true)
    .limit(1)
    .maybeSingle()

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <div className="relative min-h-[260px]">
        {featuredImage?.image_url ? (
          <>
            <Image
              src={featuredImage.image_url}
              alt={inProgressUnit.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 420px"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081018] via-[#081018]/65 to-[#081018]/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900" />
        )}

        <div className="relative z-10 flex h-full flex-col justify-end p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
            In Progress
          </p>

          <div className="mt-3 space-y-2">
            <h2 className="text-3xl font-semibold leading-tight text-white">
              {inProgressUnit.name}
            </h2>
            <p className="text-sm text-white/75">
              Last updated {new Date(inProgressUnit.updated_at).toLocaleDateString()}
            </p>
          </div>

          <div className="mt-5">
            <Link
              href={`/units/${inProgressUnit.id}`}
              className="inline-flex rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Resume Painting
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}