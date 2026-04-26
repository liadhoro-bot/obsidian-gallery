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
          role: item.role,
          ratio: item.ratio_text,
        }
      })
      .filter(Boolean) ?? []

  const uniqueRecipes = Array.from(
    new Map(recipes.map((recipe: any) => [recipe.id, recipe])).values()
  )

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-black text-white">Usage Recipes</h2>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {uniqueRecipes.length} Saved
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {uniqueRecipes.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/70 p-5 text-sm text-slate-400">
            This paint is not used in any saved recipes yet.
          </div>
        ) : (
          uniqueRecipes.map((recipe: any) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="rounded-2xl bg-slate-900/70 p-5 shadow-lg transition hover:bg-slate-800"
            >
              <div className="flex gap-4">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-800" />

                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-white">
                    {recipe.name}
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