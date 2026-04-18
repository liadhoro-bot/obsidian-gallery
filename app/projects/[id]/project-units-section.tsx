import { createClient } from '../../../utils/supabase/server'
import { setFeaturedUnit } from './actions'

type Props = {
  projectId: string
  userId: string
}

export default async function ProjectUnitsSection({ projectId, userId }: Props) {
  const supabase = await createClient()

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, name, notes, model_count, is_featured')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (unitsError) {
    return (
      <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <pre className="whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
          {JSON.stringify(unitsError, null, 2)}
        </pre>
      </section>
    )
  }

  if (!units || units.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
        <p className="text-sm uppercase tracking-wider text-cyan-400">Project Units</p>
        <h2 className="mt-1 text-xl font-semibold">Units</h2>
        <p className="mt-4 text-neutral-400">No units yet.</p>
      </section>
    )
  }

  const unitIds = units.map((unit) => unit.id)

  const [{ data: stages }, { data: unitImages }] = await Promise.all([
    supabase
      .from('unit_stage_progress')
      .select('unit_id, stage_key, is_done')
      .in('unit_id', unitIds),
    supabase
      .from('image_assets')
      .select('entity_id, image_url, is_featured')
      .eq('entity_type', 'unit')
      .eq('user_id', userId)
      .in('entity_id', unitIds)
      .order('created_at', { ascending: true }),
  ])

  const stagesByUnitId = (stages ?? []).reduce<Record<string, any[]>>((acc, stage) => {
    if (!acc[stage.unit_id]) acc[stage.unit_id] = []
    acc[stage.unit_id].push(stage)
    return acc
  }, {})

  const imagesByUnitId = (unitImages ?? []).reduce<Record<string, any[]>>((acc, image) => {
    if (!acc[image.entity_id]) acc[image.entity_id] = []
    acc[image.entity_id].push(image)
    return acc
  }, {})

  return (
    <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider text-cyan-400">
            Project Units
          </p>
          <h2 className="mt-1 text-xl font-semibold">Units</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {units.map((unit) => {
          const unitStages = stagesByUnitId[unit.id] ?? []
          const images = imagesByUnitId[unit.id] ?? []

          const primaryImage =
            images.find((image) => image.is_featured) ||
            images[0] ||
            null

          const completed = unitStages.filter((s) => s.is_done && s.stage_key !== 'done').length
          const total = unitStages.filter((s) => s.stage_key !== 'done').length || 5
          const percent = Math.round((completed / total) * 100)

          return (
            <div
              key={unit.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 transition hover:border-cyan-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/units/${unit.id}`}
                      className="text-lg font-semibold text-cyan-400"
                    >
                      {unit.name}
                    </a>

                    {unit.is_featured && (
                      <span className="rounded-full bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <form action={setFeaturedUnit}>
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="projectId" value={projectId} />

                  <button
                    type="submit"
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      unit.is_featured
                        ? 'bg-yellow-400 text-black'
                        : 'bg-neutral-800 text-white'
                    }`}
                  >
                    {unit.is_featured ? 'Featured' : 'Set Featured'}
                  </button>
                </form>
              </div>

              {primaryImage ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
                  <img
                    src={primaryImage.image_url}
                    alt={unit.name}
                    className="h-40 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="mt-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
                  No featured image
                </div>
              )}

              <p className="mt-3 text-sm text-neutral-400">
                {unit.notes || 'No notes'}
              </p>

              <div className="mt-4 space-y-1 text-sm text-neutral-500">
                <p>Models: {unit.model_count}</p>
                <p>Progress: {completed}/{total} stages ({percent}%)</p>
              </div>

              <p className="mt-3">
                <a
                  href={`/units/${unit.id}`}
                  className="text-sm text-cyan-400 hover:underline"
                >
                  Open unit page →
                </a>
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}