import { supabase } from '../../../lib/supabase'
import MobileNav from '../../components/MobileNav'
import { revalidatePath } from 'next/cache'

async function addUnit(formData: FormData) {
  'use server'

  const projectId = formData.get('projectId')?.toString()
  const name = formData.get('name')?.toString().trim()
  const modelCountValue = formData.get('modelCount')?.toString().trim()
  const notes = formData.get('notes')?.toString().trim() || null

  if (!projectId || !name) return

  const modelCount = Number(modelCountValue || '1')

  const { data: insertedUnit, error } = await supabase
    .from('units')
    .insert([
      {
        project_id: projectId,
        name,
        model_count: Number.isNaN(modelCount) ? 1 : modelCount,
        notes,
      },
    ])
    .select()
    .single()

  if (error || !insertedUnit) {
    console.error('Error adding unit:', error)
    return
  }

  const stages = [
    'assembled',
    'primed',
    'initial_paints',
    'fine_details',
    'base_rim',
    'done',
  ]

  const stageRows = stages.map((stage) => ({
    unit_id: insertedUnit.id,
    stage_key: stage,
    is_done: false,
  }))

  const { error: stageError } = await supabase
    .from('unit_stage_progress')
    .insert(stageRows)

  if (stageError) {
    console.error('Error creating unit stages:', stageError)
  }

  revalidatePath(`/projects/${projectId}`)
}
async function toggleStage(formData: FormData) {
  'use server'

  const stageId = formData.get('stageId')?.toString()
  const current = formData.get('current') === 'true'
  const projectId = formData.get('projectId')?.toString()

  if (!stageId || !projectId) return

  const { error } = await supabase
    .from('unit_stage_progress')
    .update({ is_done: !current })
    .eq('id', stageId)

  if (error) {
    console.error('Error toggling stage:', error)
  }

  revalidatePath(`/projects/${projectId}`)
}
async function setFeaturedUnit(formData: FormData) {
  'use server'

  const unitId = formData.get('unitId')?.toString()
  const projectId = formData.get('projectId')?.toString()

  if (!unitId || !projectId) return

  const { error: clearError } = await supabase
    .from('units')
    .update({ is_featured: false })
    .eq('project_id', projectId)

  if (clearError) {
    console.error('Error clearing featured unit:', clearError)
    return
  }

  const { error: setError } = await supabase
    .from('units')
    .update({ is_featured: true })
    .eq('id', unitId)

  if (setError) {
    console.error('Error setting featured unit:', setError)
    return
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
}
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-black p-6 pb-28 text-white">
      <div className="mx-auto max-w-xl">
            <NavBar />
        <a href="/" className="text-cyan-400">
          ← Back to Projects
        </a>

        {projectError ? (
          <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
            {JSON.stringify(projectError, null, 2)}
          </pre>
        ) : (
          <div className="mt-4 rounded border border-neutral-700 p-4">
            <h1 className="text-2xl font-bold">{project?.name}</h1>
            <p className="mt-2 text-neutral-300">
              {project?.description || 'No description'}
            </p>
          </div>
        )}

        <section className="mt-6 rounded border border-neutral-700 p-4">
          <h2 className="text-xl font-semibold">Add Unit</h2>

          <form action={addUnit} className="mt-4 space-y-3">
            <input type="hidden" name="projectId" value={id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Unit Name
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                placeholder="e.g. Skeleton Warriors"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Model Count
              </label>
              <input
                name="modelCount"
                type="number"
                min="1"
                defaultValue="1"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
                placeholder="Optional notes"
              />
            </div>

            <button
              type="submit"
              className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
            >
              Add Unit
            </button>
          </form>
        </section>

<section className="mt-6">
  <h2 className="text-xl font-semibold">Units</h2>

  {unitsError ? (
    <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
      {JSON.stringify(unitsError, null, 2)}
    </pre>
  ) : units && units.length > 0 ? (
    <div className="mt-4 space-y-3">
      {await Promise.all(
        units.map(async (unit) => {
          const { data: stages } = await supabase
            .from('unit_stage_progress')
            .select('*')
            .eq('unit_id', unit.id)

          const completed = stages?.filter((s) => s.is_done).length || 0
          const total = stages?.length || 1
          const percent = Math.round((completed / total) * 100)

          return (
            <div
              key={unit.id}
              className="rounded border border-neutral-700 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{unit.name}</h3>

                  <p className="text-sm text-neutral-400">
                    Models: {unit.model_count}
                  </p>

                  <p className="text-sm text-neutral-500">
                    {unit.notes || 'No notes'}
                  </p>
                </div>

                <form action={setFeaturedUnit}>
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="projectId" value={id} />

                  <button
                    type="submit"
                    className={`rounded px-3 py-2 text-xs font-medium ${
                      unit.is_featured
                        ? 'bg-yellow-400 text-black'
                        : 'bg-neutral-800 text-white'
                    }`}
                  >
                    {unit.is_featured ? 'Featured' : 'Set Featured'}
                  </button>
                </form>
              </div>

              <div className="mt-3">
                <div className="h-2 w-full rounded bg-neutral-800">
                  <div
                    className="h-2 rounded bg-cyan-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  {percent}% complete
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {stages?.map((stage) => (
                  <form key={stage.id} action={toggleStage}>
                    <input type="hidden" name="stageId" value={stage.id} />
                    <input
                      type="hidden"
                      name="current"
                      value={stage.is_done.toString()}
                    />
                    <input type="hidden" name="projectId" value={id} />

                    <button
                      type="submit"
                      className={`rounded px-2 py-1 text-xs ${
                        stage.is_done
                          ? 'bg-cyan-500 text-black'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {stage.stage_key}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  ) : (
    <p className="mt-4 text-neutral-400">No units yet.</p>
  )}
</section>

      </div>
    </main>
  )
}