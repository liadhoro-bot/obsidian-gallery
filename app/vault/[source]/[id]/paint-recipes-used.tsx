import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintRecipesUsed({
  paintRef,
}: {
  paintRef: PaintRef
}) {
  const supabase = await createClient()

  const paintColumn =
    paintRef.source === 'catalog' ? 'paint_catalog_id' : 'custom_paint_id'

  const { data: stepPaints } = await supabase
    .from('recipe_step_paints')
    .select(`
      id,
      role,
      ratio_text,
      recipe_steps (
        id,
        title,
        recipes (
          id,
          name,
          description,
          image_url,
          user_id
        )
      )
    `)
    .eq('paint_source', paintRef.source)
    .eq(paintColumn, paintRef.paintId)

  const recipes =
    stepPaints
      ?.map((item: any) => {
        const recipe = item.recipe_steps?.recipes

        if (!recipe || recipe.user_id !== paintRef.userId) {
          return null
        }

        return {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          imageUrl: recipe.image_url,
          role: item.role,
          ratio: item.ratio_text,
        }
      })
      .filter(Boolean) ?? []

  const uniqueRecipes = Array.from(
    new Map(recipes.map((recipe: any) => [recipe.id, recipe])).values()
  ) as any[]

  const recipeIds = uniqueRecipes.map((recipe) => recipe.id)

  let imageByRecipeId = new Map<string, string>()

  if (recipeIds.length > 0) {
    const { data: imageRows } = await supabase
      .from('image_assets')
      .select('entity_id, image_url, is_featured, is_primary, sort_order')
      .eq('entity_type', 'recipe')
      .in('entity_id', recipeIds)
      .order('is_featured', { ascending: false })
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })

    imageByRecipeId = new Map(
      imageRows
        ?.filter((image: any) => image.image_url)
        .map((image: any) => [image.entity_id, image.image_url]) ?? []
    )
  }

  const recipesWithImages = uniqueRecipes.map((recipe) => ({
    ...recipe,
    imageUrl: recipe.imageUrl || imageByRecipeId.get(recipe.id) || null,
  }))

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-black text-white">Usage Recipes</h2>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {recipesWithImages.length} Saved
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {recipesWithImages.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/70 p-5 text-sm text-slate-400">
            This paint is not used in any saved recipes yet.
          </div>
        ) : (
          recipesWithImages.map((recipe: any) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="rounded-2xl bg-slate-900/70 p-5 shadow-lg transition hover:bg-slate-800"
            >
              <div className="flex gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                  {recipe.imageUrl ? (
                    <Image
                      src={recipe.imageUrl}
                      alt={recipe.name || 'Recipe image'}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-600">
                      OG
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-black text-white">
                    {recipe.name || 'Untitled recipe'}
                  </h3>

                  {recipe.description ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                      {recipe.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipe.role ? (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                        {recipe.role}
                      </span>
                    ) : null}

                    {recipe.ratio ? (
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                        {recipe.ratio}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}