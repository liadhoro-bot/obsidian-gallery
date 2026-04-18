import { createClient } from '../../utils/supabase/server'

export default async function RecipesStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [{ count: recipeCount }, { data: imageRows }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('image_assets')
      .select('entity_id')
      .eq('user_id', user.id)
      .eq('entity_type', 'recipe'),
  ])

  const totalRecipes = recipeCount || 0
  const recipesWithImages = new Set((imageRows || []).map((row) => row.entity_id)).size

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Recipes</p>
        <p className="mt-2 text-2xl font-bold text-white">{totalRecipes}</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">With images</p>
        <p className="mt-2 text-2xl font-bold text-white">{recipesWithImages}</p>
      </div>
    </section>
  )
}