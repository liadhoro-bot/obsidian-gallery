import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import RecipesPageClient from './recipes-page-client'
import { createPerfTimer } from '../../utils/perf/server'
import { getCachedPublicRecipes } from '../../lib/public-cache'
import { getDashboardProfile } from '../dashboard/dashboard-data'

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
  recipes?: RecipeRow | RecipeRow[] | null
}

type RecipesPageProps = {
  searchParams?: Promise<{
    tab?: string
  }>
}

type RecipesTab = 'find' | 'mine' | 'custom'

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function RecipesContent({
  userId,
  activeTab,
}: {
  userId: string
  activeTab: RecipesTab
}) {
  const perf = createPerfTimer('/recipes:content')
  const supabase = await createClient()

  const [publicRecipes, myRecipesResult, savedRowsResult] = await Promise.all([
    getCachedPublicRecipes(),
    supabase
      .from('recipes')
      .select(
        'id, name, description, image_url, is_public, created_at, user_id'
      )
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

  const myRecipes = (myRecipesResult.data ?? []) as RecipeRow[]
  const typedSavedRows = (savedRowsResult.data ?? []) as SavedRecipeRow[]
  const savedRecipes = typedSavedRows
    .map((row) => firstValue(row.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))

  const publicRecipeMap = new Map<string, RecipeRow>()
  for (const recipe of publicRecipes) {
    publicRecipeMap.set(recipe.id, recipe)
  }

  for (const recipe of myRecipes) {
    if (recipe.is_public) {
      publicRecipeMap.set(recipe.id, recipe)
    }
  }

  const allPublicRecipes = Array.from(publicRecipeMap.values()).sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  )

  const recipeIds = [
    ...allPublicRecipes.filter((recipe) => !recipe.image_url).map((recipe) => recipe.id),
    ...myRecipes.filter((recipe) => !recipe.image_url).map((recipe) => recipe.id),
    ...savedRecipes.filter((recipe) => !recipe.image_url).map((recipe) => recipe.id),
  ]

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
  perf.total()

  return (
    <RecipesPageClient
      activeTab={activeTab}
      publicRecipes={withRecipeImages(allPublicRecipes)}
      myRecipes={withRecipeImages(myRecipes)}
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

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const perf = createPerfTimer('/recipes')
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) redirect('/login')

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestedTab =
    resolvedSearchParams?.tab === 'find' ||
    resolvedSearchParams?.tab === 'custom' ||
    resolvedSearchParams?.tab === 'mine'
      ? resolvedSearchParams.tab
      : null

  let activeTab: RecipesTab
  if (requestedTab) {
    activeTab = requestedTab
  } else {
    const [{ data: myRecipe }, { data: savedRecipe }] = await Promise.all([
      supabase
        .from('recipes')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('saved_recipes')
        .select('recipe_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle(),
    ])

    activeTab = myRecipe || savedRecipe ? 'mine' : 'find'
  }

  const profilePromise = (async () => ({
    data: await getDashboardProfile(user.id),
  }))()
  perf.total()

  return (
    <main className="min-h-screen bg-[#03070b] pb-24 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <section className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Paint Scheme Management
          </p>

          <h1 className="text-4xl font-black tracking-tight text-white">
            The Guide Library
          </h1>

          <p className="text-sm font-medium text-neutral-200">
            Record, share, and discover painting guides.
          </p>
          <p className="text-base leading-7 text-neutral-400">
            Browse community guides for inspiration, or turn your techniques
            into step-by-step guides with paint combinations and progress photos.
            Learn from the community, preserve your knowledge, and make it easy
            to recreate successful paint schemes across projects.
          </p>
        </section>

        <Suspense fallback={<RecipesContentSkeleton />}>
          <RecipesContent userId={user.id} activeTab={activeTab} />
        </Suspense>
      </div>
    </main>
  )
}
