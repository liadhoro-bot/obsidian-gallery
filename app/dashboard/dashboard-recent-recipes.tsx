import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

export default async function DashboardRecentRecipes() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      id,
      title,
      created_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(4)

  if (error) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Recent Recipes</h2>
        <p className="mt-3 text-sm text-red-300">Could not load recipes.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Recipes</h2>
        <Link href="/recipes" className="text-sm text-white/70 hover:text-white">
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {recipes?.length ? (
          recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="block rounded-xl border border-white/10 bg-black/20 p-3 transition hover:bg-white/5"
            >
              <p className="font-medium">{recipe.title}</p>
              <p className="mt-1 text-xs text-white/50">
                Created {new Date(recipe.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-white/60">No recipes yet.</p>
        )}
      </div>
    </section>
  )
}