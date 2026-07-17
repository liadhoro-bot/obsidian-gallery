import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

type RecipeUsage = {
  id: string
  name: string | null
  imageUrl: string | null
  stepLabel: string | null
}

type StageUsage = {
  id: string
  unitId: string
  unitName: string | null
  stageLabel: string | null
  stageKey: string | null
  imageUrl: string | null
}

type StepPaintUsageRow = {
  recipe_steps?: {
    recipe_id?: string | null
    step_number?: number | null
    title?: string | null
    recipes?: {
      id: string
      name: string | null
      description: string | null
      image_url: string | null
      user_id: string
    } | null
  } | null
}

type RecipeImageRow = {
  entity_id: string
  image_url: string | null
}

type UnitImageRow = {
  entity_id: string
  image_url: string | null
  alt_text: string | null
  is_featured: boolean | null
}

type StagePaintUsageRow = {
  id: string
  units?: {
    id: string
    name: string | null
  } | null
  unit_progress_steps?: {
    id: string
    step_key: string | null
    step_label: string | null
    status: string | null
  } | null
}

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function PaintUsedIn({
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
      recipe_steps:recipe_step_id (
        id,
        recipe_id,
        step_number,
        title,
        instructions,
        image_url,
        recipes:recipe_id (
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
    .eq('user_id', paintRef.userId)

  const { data: stagePaints } = await supabase
    .from('unit_stage_paints')
    .select(`
      id,
      units:unit_id (
        id,
        name
      ),
      unit_progress_steps:progress_step_id (
        id,
        step_key,
        step_label,
        status
      )
    `)
    .eq('paint_source', paintRef.source)
    .eq(paintColumn, paintRef.paintId)
    .eq('user_id', paintRef.userId)
    .order('sort_order', { ascending: true })

  const stepPaintRows = (stepPaints ?? []) as unknown as StepPaintUsageRow[]
  const stagePaintRows = (stagePaints ?? []) as unknown as StagePaintUsageRow[]

  const recipes =
    stepPaintRows
      .map((item) => {
        const recipeStep = firstValue(item.recipe_steps)
        const recipe = firstValue(recipeStep?.recipes)

        if (!recipe || recipe.user_id !== paintRef.userId) {
          return null
        }

        return {
          id: recipe.id,
          name: recipe.name,
          imageUrl: recipe.image_url,
          stepLabel:
            recipeStep?.title ||
            (recipeStep?.step_number
              ? `Step ${recipeStep.step_number}`
              : null),
        }
      })
      .filter((recipe): recipe is RecipeUsage => Boolean(recipe))

  const uniqueRecipes = Array.from(
    new Map(recipes.map((recipe) => [recipe.id, recipe])).values()
  ) as RecipeUsage[]

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
        ?.filter(
          (image: RecipeImageRow): image is RecipeImageRow & { image_url: string } =>
            Boolean(image.image_url)
        )
        .map((image) => [image.entity_id, image.image_url]) ?? []
    )
  }

  const recipesWithImages = uniqueRecipes.map((recipe) => ({
    ...recipe,
    imageUrl: recipe.imageUrl || imageByRecipeId.get(recipe.id) || null,
  }))

  const stageUsagesWithoutImages = stagePaintRows
    .map((item): StageUsage | null => {
      const unit = firstValue(item.units)
      const stage = firstValue(item.unit_progress_steps)

      if (!unit?.id) {
        return null
      }

      return {
        id: item.id,
        unitId: unit.id,
        unitName: unit.name,
        stageLabel: stage?.step_label ?? null,
        stageKey: stage?.step_key ?? null,
        imageUrl: null,
      }
    })
    .filter((stage): stage is StageUsage => Boolean(stage))

  const stageUnitIds = Array.from(
    new Set(stageUsagesWithoutImages.map((usage) => usage.unitId))
  )
  const stageImageByUnitAndKey = new Map<string, string>()
  const featuredImageByUnit = new Map<string, string>()

  if (stageUnitIds.length > 0) {
    const { data: unitImageRows } = await supabase
      .from('image_assets')
      .select('entity_id, image_url, alt_text, is_featured, sort_order, created_at')
      .eq('entity_type', 'unit')
      .eq('user_id', paintRef.userId)
      .in('entity_id', stageUnitIds)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    for (const image of (unitImageRows ?? []) as UnitImageRow[]) {
      if (!image.image_url) {
        continue
      }

      if (image.alt_text?.startsWith('stage:')) {
        stageImageByUnitAndKey.set(
          `${image.entity_id}:${image.alt_text.slice('stage:'.length)}`,
          image.image_url
        )
      }

      if (image.is_featured && !featuredImageByUnit.has(image.entity_id)) {
        featuredImageByUnit.set(image.entity_id, image.image_url)
      }
    }
  }

  const stageUsages = stageUsagesWithoutImages.map((usage) => ({
    ...usage,
    imageUrl:
      (usage.stageKey
        ? stageImageByUnitAndKey.get(`${usage.unitId}:${usage.stageKey}`)
        : null) ||
      featuredImageByUnit.get(usage.unitId) ||
      null,
  }))

  const savedCount = recipesWithImages.length + stageUsages.length

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-black text-white">Used In</h2>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {savedCount} Saved
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {savedCount === 0 ? (
          <div className="rounded-2xl bg-slate-900/70 p-5 text-sm text-slate-400">
            This paint is not used in any saved guides or unit stages yet.
          </div>
        ) : (
          <>
            {recipesWithImages.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Guides
                </div>

                <div className="flex flex-col gap-3">
                  {recipesWithImages.map((recipe) => (
                    <Link
                      key={recipe.id}
                      href={`/recipes/${recipe.id}`}
                      className="rounded-2xl bg-slate-900/70 p-2 shadow-lg transition hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                          {recipe.imageUrl ? (
                            <Image
                              src={recipe.imageUrl}
                              alt={recipe.name || 'Guide image'}
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
                            {recipe.name || 'Untitled guide'}
                          </h3>

                          <div className="mt-0.5 truncate text-sm leading-5 text-slate-400">
                            {recipe.stepLabel || 'Guide step'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {stageUsages.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                  Unit Stages
                </div>

                <div className="flex flex-col gap-3">
                  {stageUsages.map((usage) => (
                    <Link
                      key={usage.id}
                      href={`/units/${usage.unitId}`}
                      className="rounded-2xl bg-slate-900/70 p-2 shadow-lg transition hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-cyan-400/10">
                          {usage.imageUrl ? (
                            <Image
                              src={usage.imageUrl}
                              alt={usage.unitName || 'Unit image'}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-black uppercase tracking-wider text-cyan-300">
                              {(usage.unitName || 'Unit')
                                .trim()
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((word) => word[0])
                                .join('')}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-black text-white">
                            {usage.unitName || 'Untitled unit'}
                          </h3>

                          <div className="mt-0.5 truncate text-sm leading-5 text-slate-400">
                            {usage.stageLabel || 'Progress stage'}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
