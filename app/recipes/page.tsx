import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import RecipesPageClient from './recipes-page-client'

export default async function RecipesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: publicRecipes }, { data: myRecipes }, { data: savedRows }] =
    await Promise.all([
      supabase
        .from('recipes')
        .select('id, name, description, image_url, is_public, created_at, user_id')
        .eq('is_public', true)
        .order('created_at', { ascending: false }),

      supabase
        .from('recipes')
        .select('id, name, description, image_url, is_public, created_at, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('saved_recipes')
        .select(
          `
          recipe_id,
          recipes (
            id,
            name,
            description,
            image_url,
            is_public,
            created_at,
            user_id
          )
        `
        )
        .eq('user_id', user.id),
    ])

  // ✅ FIX: must come BEFORE recipeIds
  const savedRecipes =
    savedRows
      ?.map((row: any) => row.recipes)
      .filter(Boolean) ?? []

  // Collect all recipe IDs for image lookup
  const recipeIds = [
    ...(publicRecipes ?? []).map((r) => r.id),
    ...(myRecipes ?? []).map((r) => r.id),
    ...savedRecipes.map((r: any) => r.id),
  ]

  // Fetch images safely (avoid empty .in())
  const { data: imageRows } = recipeIds.length
    ? await supabase
        .from('image_assets')
        .select('entity_id, image_url')
        .eq('entity_type', 'recipe')
        .in('entity_id', recipeIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const imageByRecipeId = new Map(
    (imageRows ?? []).map((row) => [row.entity_id, row.image_url])
  )

  const withRecipeImages = (recipes: any[]) =>
    recipes.map((recipe) => ({
      ...recipe,
      image_url: recipe.image_url || imageByRecipeId.get(recipe.id) || null,
    }))

  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <DashboardTopBar userId={user.id} />

        <RecipesPageClient
          publicRecipes={withRecipeImages(publicRecipes ?? [])}
          myRecipes={withRecipeImages(myRecipes ?? [])}
          savedRecipes={withRecipeImages(savedRecipes)}
          savedRecipeIds={(savedRows ?? []).map((row: any) => row.recipe_id)}
        />
      </div>

      <MobileNav />
    </main>
  )
}