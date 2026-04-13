import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import MobileNav from '../components/MobileNav'
import RecipesPageClient from './recipes-page-client'

type RecipeWithImage = {
  id: string
  name: string
  description: string | null
  inventory_required: string | null
  expert_tips: string | null
  created_at: string
  primaryImage: {
    image_url: string
    alt_text: string | null
  } | null
}

export default async function RecipesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  async function createRecipe(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const name = formData.get('name')?.toString().trim()
    const descriptionRaw = formData.get('description')?.toString().trim()

    if (!name) {
      throw new Error('Recipe name is required')
    }

    const insertPayload = {
      name,
      description: descriptionRaw || null,
    }

    const { data: newRecipe, error } = await supabase
      .from('recipes')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error || !newRecipe) {
      throw new Error(error?.message || 'Failed to create recipe')
    }

    redirect(`/recipes/${newRecipe.id}`)
  }

  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select(`
      id,
      name,
      description,
      inventory_required,
      expert_tips,
      created_at
    `)
    .order('created_at', { ascending: false })

  if (recipesError) {
    throw new Error(recipesError.message)
  }

  const recipeIds = (recipes ?? []).map((recipe) => recipe.id)

  let featuredImagesByRecipeId: Record<
    string,
    {
      image_url: string
      alt_text: string | null
    }
  > = {}

  if (recipeIds.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from('image_assets')
      .select(`
        entity_id,
        image_url,
        alt_text,
        is_featured,
        created_at
      `)
      .eq('entity_type', 'recipe')
      .in('entity_id', recipeIds)
      .order('created_at', { ascending: true })

    if (imagesError) {
      throw new Error(imagesError.message)
    }

    for (const recipeId of recipeIds) {
      const recipeImages = (images ?? []).filter(
        (image) => image.entity_id === recipeId
      )

      const primaryImage =
        recipeImages.find((image) => image.is_featured) ||
        recipeImages[0] ||
        null

      if (primaryImage) {
        featuredImagesByRecipeId[recipeId] = {
          image_url: primaryImage.image_url,
          alt_text: primaryImage.alt_text,
        }
      }
    }
  }

  const recipesWithImages: RecipeWithImage[] = (recipes ?? []).map((recipe) => ({
    ...recipe,
    primaryImage: featuredImagesByRecipeId[recipe.id] || null,
  }))

  return (
    <main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-3xl">
        <MobileNav />

        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">
            Obsidian Gallery
          </p>
          <h1 className="mt-2 text-3xl font-bold">Recipes</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Save paint recipes and step-by-step miniature workflows.
          </p>

          <div className="mt-4">
            <RecipesPageClient createRecipeAction={createRecipe} />
          </div>
        </header>

        <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                Recipe Library
              </p>
              <h2 className="mt-1 text-xl font-semibold">All Recipes</h2>
            </div>
          </div>

          {recipesWithImages.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {recipesWithImages.map((recipe) => (
                <a
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="block rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 transition hover:border-cyan-500"
                >
                  <h3 className="text-lg font-semibold text-cyan-400">
                    {recipe.name}
                  </h3>

                  {recipe.primaryImage ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
                      <img
                        src={recipe.primaryImage.image_url}
                        alt={recipe.primaryImage.alt_text || recipe.name}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
                      No featured image
                    </div>
                  )}

                  <p className="mt-3 line-clamp-2 text-sm text-neutral-400">
                    {recipe.description || 'No description'}
                  </p>

                  <div className="mt-4 space-y-1 text-sm text-neutral-500">
                    <p>
                      Inventory:{' '}
                      {recipe.inventory_required ? 'Added' : 'Not added'}
                    </p>
                    <p>
                      Tips:{' '}
                      {recipe.expert_tips ? 'Added' : 'Not added'}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">
              No recipes yet. Create your first recipe to start building your library.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}