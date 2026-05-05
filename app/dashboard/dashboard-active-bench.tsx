import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

type StageProgressRow = {
  unit_id: string
  stage_key: string
  is_done: boolean
}

type UnitImageRow = {
  entity_id: string
  image_url: string
}

type SessionRow = {
  unit_id: string
  started_at: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function DashboardActiveBench({
  userId,
}: {
  userId?: string
}) {
  const supabase = await createClient()

  let resolvedUserId = userId

  if (!resolvedUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    resolvedUserId = user.id
  }

  const { data: units, error } = await supabase
    .from('units')
    .select('id, name, deadline')
    .eq('user_id', resolvedUserId)
    .eq('is_active', true)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(8)

  if (error || !units?.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/60">No active bench units yet.</p>
      </section>
    )
  }

  const unitIds = units.map((unit) => unit.id)

  const [progressResult, imageResult, sessionResult] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .in('unit_id', unitIds)
      .eq('is_done', true),

    supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'unit')
      .eq('is_featured', true)
      .in('entity_id', unitIds),

    supabase
      .from('unit_sessions')
      .select('unit_id, started_at')
      .in('unit_id', unitIds)
      .order('started_at', { ascending: false })
      .limit(8),
  ])

  const progressRows = (progressResult.data ?? []) as StageProgressRow[]
  const imageRows = (imageResult.data ?? []) as UnitImageRow[]
  const sessionRows = (sessionResult.data ?? []) as SessionRow[]

  const progressMap = new Map<string, number>()

  for (const unit of units) {
    progressMap.set(unit.id, 0)
  }

  for (const row of progressRows) {
    if (row.stage_key === 'done') {
      progressMap.set(row.unit_id, 100)
      continue
    }

    progressMap.set(row.unit_id, (progressMap.get(row.unit_id) || 0) + 20)
  }

  const imageMap = new Map<string, string>()

  for (const row of imageRows) {
    imageMap.set(row.entity_id, row.image_url)
  }

  const lastSessionMap = new Map<string, string>()

  for (const row of sessionRows) {
    if (!lastSessionMap.has(row.unit_id)) {
      lastSessionMap.set(row.unit_id, row.started_at)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-semibold text-white">
          Active Bench Units
        </h2>

        <p className="text-sm text-white/60">
          {units.length} in progress
        </p>
      </div>

      <div className="space-y-3">
        {units.map((unit) => {
          const imageUrl = imageMap.get(unit.id)
          const lastSession = lastSessionMap.get(unit.id)
          const progress = progressMap.get(unit.id) || 0

          return (
            <Link
              key={unit.id}
              href={`/units/${unit.id}`}
              className="flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition hover:bg-white/[0.08]"
            >
              <div className="relative w-[30%] min-h-[110px]">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={unit.name}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/5 text-xs text-white/40">
                    No image
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <p className="text-lg font-semibold leading-tight text-white">
                    {unit.name}
                  </p>

                  <p className="mt-2 text-xs text-white/60">
                    LAST SESSION: {formatDate(lastSession)}
                  </p>

                  <p className="text-xs font-semibold text-orange-400">
                    DEADLINE: {formatDate(unit.deadline)}
                  </p>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-cyan-300">
                    PROGRESS: {progress}%
                  </p>

                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-cyan-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}