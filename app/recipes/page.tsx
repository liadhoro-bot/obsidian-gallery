import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import RecipesPageClient from './recipes-page-client'
import { getCachedPublicRecipes } from '../../lib/public-cache'
import { createPerfTimer } from '../../utils/perf/server'

type RecipeRow = {
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
  created_at: string | null
  user_id: string | null
}

type SavedRecipeRow = {
  recipe_id: string
  recipes: RecipeRow | RecipeRow[] | null
}

function firstValue<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value
}

async function RecipesContent({ userId }: { userId: string }) {
  const perf = createPerfTimer('/recipes:content')
  const supabase = await createClient()

  const [publicRecipes, { data: myRecipes }, { data: savedRows }] =
    await Promise.all([
      getCachedPublicRecipes(),

      supabase
        .from('recipes')
        .select('id, name, description, image_url, is_public, created_at, user_id')
        .eq('user_id', userId)
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
        .eq('user_id', userId),
    ])
  perf.mark('main Supabase query')

  // ✅ FIX: must come BEFORE recipeIds
  const typedSavedRows = (savedRows ?? []) as SavedRecipeRow[]
  const savedRecipes = typedSavedRows
    .map((row) => firstValue(row.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))

  // Collect all recipe IDs for image lookup
  const recipeIds = [
    ...(publicRecipes ?? []).map((r) => r.id),
    ...(myRecipes ?? []).map((r) => r.id),
    ...savedRecipes.map((r) => r.id),
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
  perf.mark('image/gallery queries')

  const imageByRecipeId = new Map(
    (imageRows ?? []).map((row) => [row.entity_id, row.image_url])
  )

  const withRecipeImages = (recipes: RecipeRow[]) =>
    recipes.map((recipe) => ({
      ...recipe,
      image_url: recipe.image_url || imageByRecipeId.get(recipe.id) || null,
    }))

  return (
    <RecipesPageClient
      publicRecipes={withRecipeImages(publicRecipes ?? [])}
      myRecipes={withRecipeImages(myRecipes ?? [])}
      savedRecipes={withRecipeImages(savedRecipes)}
      savedRecipeIds={typedSavedRows.map((row) => row.recipe_id)}
    />
  )
}

function RecipesContentSkeleton() {
  return (
    <section className="space-y-5 animate-pulse">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <div className="h-10 rounded-lg bg-white/10" />
        <div className="h-10 rounded-lg bg-white/10" />
        <div className="h-10 rounded-lg bg-white/10" />
      </div>

      <div className="space-y-5">
        <div className="h-11 rounded-xl bg-white/10" />
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              <div className="aspect-square bg-white/10" />
              <div className="p-3">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-2 h-3 w-full rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default async function RecipesPage() {
  const perf = createPerfTimer('/recipes')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) redirect('/login')
  perf.total()

  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <DashboardTopBar userId={user.id} />

        <section className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Paint Scheme Management
          </p>

          <h1 className="text-4xl font-black tracking-tight text-white">
            The Recipe Library
          </h1>

          <p className="text-base leading-7 text-neutral-400">
            Browse public painting recipes, save your favorites, and build custom
            step-by-step schemes for your miniatures.
          </p>
        </section>

        <Suspense fallback={<RecipesContentSkeleton />}>
          <RecipesContent userId={user.id} />
        </Suspense>
      </div>
    </main>
  )
}

