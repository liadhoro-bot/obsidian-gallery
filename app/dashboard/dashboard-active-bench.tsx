import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

type UnitRow = {
  id: string
  name: string
  updated_at: string
}

type StageProgressRow = {
  unit_id: string
  stage_key: string
  is_done: boolean
}

type UnitImageRow = {
  entity_id: string
  image_url: string
}

export default async function DashboardActiveBench() {
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
      updated_at
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(24)

  if (error || !units?.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
            Active Bench Units
          </h2>
          <Link href="/projects" className="text-sm text-cyan-300 hover:text-cyan-200">
            View All
          </Link>
        </div>

        <p className="mt-4 text-sm text-white/60">No active bench units yet.</p>
      </section>
    )
  }

  const unitIds = units.map((unit) => unit.id)

  const [progressResult, imageResult] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .in('unit_id', unitIds)
      .in('stage_key', ['assembled', 'done']),

    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('is_featured', true)
      .in('entity_id', unitIds),
  ])

  const progressRows = progressResult.data ?? []
  const imageRows = imageResult.data ?? []

  const progressByUnit = new Map<string, { assembled: boolean; done: boolean }>()

  for (const unit of units) {
    progressByUnit.set(unit.id, { assembled: false, done: false })
  }

  for (const row of progressRows as StageProgressRow[]) {
    const current = progressByUnit.get(row.unit_id)

    if (!current) continue

    if (row.stage_key === 'assembled' && row.is_done === true) {
      current.assembled = true
    }

    if (row.stage_key === 'done' && row.is_done === true) {
      current.done = true
    }
  }

  const imageMap = new Map<string, string>()

  for (const row of imageRows as UnitImageRow[]) {
    if (!imageMap.has(row.entity_id) && row.image_url) {
      imageMap.set(row.entity_id, row.image_url)
    }
  }

  const activeBenchUnits = (units as UnitRow[])
    .filter((unit) => {
      const progress = progressByUnit.get(unit.id)

      if (!progress) return false

      return progress.assembled === true && progress.done === false
    })
    .slice(0, 6)

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
          Active Bench Units
        </h2>
        <Link href="/projects" className="text-sm text-cyan-300 hover:text-cyan-200">
          View All
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {activeBenchUnits.length ? (
          activeBenchUnits.map((unit) => {
            const imageUrl = imageMap.get(unit.id)

            return (
              <Link
                key={unit.id}
                href={`/units/${unit.id}`}
                className="block rounded-2xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={unit.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-white">
                      {unit.name}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      On the bench · Last updated{' '}
                      {new Date(unit.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-cyan-400/15 px-2.5 py-1 text-xs font-medium text-cyan-300">
                    Active
                  </span>
                </div>
              </Link>
            )
          })
        ) : (
          <p className="text-sm text-white/60">
            No assembled unfinished units found.
          </p>
        )}
      </div>
    </section>
  )
}