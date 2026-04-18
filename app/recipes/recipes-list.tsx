import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'

type Props = {
  q: string
}

type RecipeRow = {
  id: string
  name: string | null
  description: string | null
  created_at: string | null
}

type RecipeImageRow = {
  id: string
  entity_id: string
  image_url: string
  alt_text: string | null
  is_featured: boolean | null
  created_at: string | null
}

export default async function RecipesList({ q }: Props) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  let recipesQuery = supabase
    .from('recipes')
    .select('id, name, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (q) {
    recipesQuery = recipesQuery.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
  }

  const { data: recipes, error } = await recipesQuery

  if (error) {
    throw new Error(error.message)
  }

  const recipeRows = (recipes || []) as RecipeRow[]
  const recipeIds = recipeRows.map((recipe) => recipe.id)

  let imageMap = new Map<string, RecipeImageRow>()

  if (recipeIds.length > 0) {
    const { data: images, error: imagesError } = await supabase
      .from('image_assets')
      .select('id, entity_id, image_url, alt_text, is_featured, created_at')
      .eq('user_id', user.id)
      .eq('entity_type', 'recipe')
      .in('entity_id', recipeIds)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true })

    if (imagesError) {
      throw new Error(imagesError.message)
    }

    for (const image of (images || []) as RecipeImageRow[]) {
      if (!imageMap.has(image.entity_id)) {
        imageMap.set(image.entity_id, image)
      }
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Recipes</h2>
          <p className="text-sm text-neutral-400">
            Showing {recipeRows.length} recipe{recipeRows.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {recipeRows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-semibold text-white">No recipes yet</p>
          <p className="mt-2 text-sm text-neutral-400">
            Create your first recipe to start building your library.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recipeRows.map((recipe) => {
            const featuredImage = imageMap.get(recipe.id)

            return (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 shadow-sm transition hover:border-cyan-500"
              >
                <div className="relative h-40 bg-neutral-950">
                  {featuredImage ? (
                    <Image
                      src={featuredImage.image_url}
                      alt={featuredImage.alt_text || recipe.name || 'Recipe image'}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white">
                    {recipe.name || 'Untitled recipe'}
                  </h3>

                  {recipe.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-neutral-400">
                      {recipe.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">
                      No description
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}