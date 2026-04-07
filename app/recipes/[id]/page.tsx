import { supabase } from '../../../lib/supabase'
import MobileNav from '../../components/MobileNav'
import { revalidatePath } from 'next/cache'

async function addRecipeStep(formData: FormData) {
  'use server'

  const recipeId = formData.get('recipeId')?.toString()
  const title = formData.get('title')?.toString().trim()
  const instructions = formData.get('instructions')?.toString().trim()
const paintIdRaw = formData.get('paintId')?.toString()
const paintId = paintIdRaw && paintIdRaw !== '' ? paintIdRaw : null

  if (!recipeId || !title || !instructions) return

  const { data: existingSteps, error: fetchError } = await supabase
    .from('recipe_steps')
    .select('step_number')
    .eq('recipe_id', recipeId)
    .order('step_number', { ascending: false })
    .limit(1)

  if (fetchError) {
    console.error('Error fetching steps:', fetchError)
    return
  }

  const nextStepNumber =
    existingSteps && existingSteps.length > 0
      ? existingSteps[0].step_number + 1
      : 1

const { error } = await supabase.from('recipe_steps').insert([
  {
    recipe_id: recipeId,
    step_number: nextStepNumber,
    title,
    instructions,
    paint_id: paintId,
  },
])

if (error) {
  console.error('Error adding recipe step:', error)
  throw new Error(JSON.stringify(error))
}

  revalidatePath(`/recipes/${recipeId}`)
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

const { data: recipe, error: recipeError } = await supabase
  .from('recipes')
  .select('*')
  .eq('id', id)
  .single()

const { data: steps, error: stepsError } = await supabase
  .from('recipe_steps')
  .select('*')
  .eq('recipe_id', id)
  .order('step_number', { ascending: true })

const { data: paints } = await supabase
  .from('paints')
  .select('*')
  .order('name', { ascending: true })

  return (
    <main className="min-h-screen bg-black p-6 pb-28 text-white">
      <div className="mx-auto max-w-xl">
            <MobileNav />
        <a href="/recipes" className="text-cyan-400">
          ← Back to Recipes
        </a>

        {recipeError ? (
          <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
            {JSON.stringify(recipeError, null, 2)}
          </pre>
        ) : (
          <section className="mt-4 rounded border border-neutral-700 p-4">
            <h1 className="text-3xl font-bold">{recipe?.name}</h1>
            <p className="mt-2 text-neutral-400">
              {recipe?.description || 'No description'}
            </p>
          </section>
        )}

        <section className="mt-6 rounded border border-neutral-700 p-4">
          <h2 className="text-xl font-semibold">Add Step</h2>

          <form action={addRecipeStep} className="mt-4 space-y-3">
            <input type="hidden" name="recipeId" value={id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Step Title
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="e.g. Basecoat"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Instructions
              </label>
              <textarea
                name="instructions"
                rows={4}
                required
                placeholder="Describe what to do in this step"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>
<div>
  <label className="mb-1 block text-sm text-neutral-300">
    Paint (optional)
  </label>

  <select
    name="paintId"
    className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
  >
    <option value="">No paint selected</option>

    {paints?.map((paint) => (
      <option key={paint.id} value={paint.id}>
        {paint.name}
      </option>
    ))}
  </select>
</div>
            <button
              type="submit"
              className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
            >
              Add Step
            </button>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Steps</h2>

          {stepsError ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
              {JSON.stringify(stepsError, null, 2)}
            </pre>
          ) : steps && steps.length > 0 ? (
            <div className="mt-4 space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="rounded border border-neutral-700 p-4"
                >
                  <p className="text-sm text-cyan-400">
                    Step {step.step_number}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    {step.instructions}
                  </p>
{step.paint_id && (() => {
  const paint = paints?.find((p) => p.id === step.paint_id)

  if (!paint) return null

  return (
    <div className="mt-2 flex items-center gap-2 text-sm text-cyan-400">
      {/* 🎨 Color swatch */}
      <div
        className="h-4 w-4 rounded border border-neutral-600"
        style={{ backgroundColor: paint.color_hex || '#000' }}
      />

      {/* Paint name */}
      <span>{paint.name}</span>
    </div>
  )
})()}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No steps yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}