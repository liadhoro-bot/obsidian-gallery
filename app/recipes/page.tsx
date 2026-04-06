import { supabase } from '../../lib/supabase'
import NavBar from '../components/NavBar'
import { revalidatePath } from 'next/cache'

async function addRecipe(formData: FormData) {
  'use server'

  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim() || null

  if (!name) return

  const { error } = await supabase.from('recipes').insert([
    {
      name,
      description,
    },
  ])

  if (error) {
    console.error('Error adding recipe:', error)
    return
  }

  revalidatePath('/recipes')
}

export default async function RecipesPage() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl">
            <NavBar />
        <a href="/" className="text-cyan-400">
          ← Back to Projects
        </a>

        <h1 className="mt-4 text-3xl font-bold">Recipes</h1>

        {/* Add Recipe */}
        <section className="mt-6 rounded border border-neutral-700 p-4">
          <h2 className="text-xl font-semibold">Add Recipe</h2>

          <form action={addRecipe} className="mt-4 space-y-3">
            <input
              name="name"
              type="text"
              required
              placeholder="Recipe name"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            />

            <textarea
              name="description"
              placeholder="Optional description"
              rows={3}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
            />

            <button
              type="submit"
              className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
            >
              Add Recipe
            </button>
          </form>
        </section>

        {/* Recipe List */}
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Your Recipes</h2>

          {error ? (
            <pre className="mt-4 bg-red-100 p-4 text-black text-sm">
              {JSON.stringify(error, null, 2)}
            </pre>
          ) : recipes && recipes.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recipes.map((recipe) => (
                <a
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="block rounded border border-neutral-700 p-4"
                >
                  <h3 className="text-lg font-semibold text-cyan-400">
                    {recipe.name}
                  </h3>
                  <p className="text-sm text-neutral-400">
                    {recipe.description || 'No description'}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No recipes yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}