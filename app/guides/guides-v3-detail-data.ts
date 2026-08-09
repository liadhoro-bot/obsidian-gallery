import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import {
  getGuideDeckThumbnail,
  getGuidesV3Payload,
  type GuidesV3Deck,
  type GuidesV3GuideFile,
} from './guides-v3-data'

export type GuidesV3DeckStep = {
  id: string
  number: number
  title: string
  instructions: string
  image: string | null
}

export type GuidesV3DeckPaint = {
  id: string
  name: string
  brand: string
  line: string
  color: string
}

export type GuidesV3DeckDetail = GuidesV3Deck & {
  description: string
  isPublic: boolean
  ownerLabel: string
  steps: GuidesV3DeckStep[]
  paintList: GuidesV3DeckPaint[]
}

export type GuidesV3GuideDetail = GuidesV3GuideFile & {
  decksList: GuidesV3Deck[]
}

type RecipeRow = {
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
  user_id: string | null
}

type StepRow = {
  id: string
  step_number: number | null
  title: string | null
  instructions: string | null
  image_url: string | null
}

type StepPaintRow = {
  recipe_step_id: string
  paint_source: string | null
  catalog_paint?: {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
  }[] | {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
  } | null
  custom_paint?: {
    id: string
    name: string | null
    manufacturer: string | null
    series: string | null
    color_hex: string | null
  }[] | {
    id: string
    name: string | null
    manufacturer: string | null
    series: string | null
    color_hex: string | null
  } | null
}

const fallbackImage = '/onboarding/pains/tough-choices.jpeg'

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function clean(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function accentFor(seed: string) {
  const colors = ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#1e4f92']
  const index =
    seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    colors.length

  return colors[index] ?? colors[0]
}

function categoryFor(recipe: RecipeRow) {
  const haystack = `${recipe.name ?? ''} ${recipe.description ?? ''}`.toLowerCase()
  if (haystack.includes('base')) return 'Basing'
  if (haystack.includes('bone') || haystack.includes('skeleton')) return 'Bone'
  if (haystack.includes('gold')) return 'Gold'
  if (haystack.includes('metal') || haystack.includes('brass')) return 'Metal'
  if (haystack.includes('weather') || haystack.includes('rust')) return 'Weathering'
  return 'Technique'
}

async function loadRecipeImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipe: RecipeRow
) {
  if (recipe.image_url) return recipe.image_url

  const { data, error } = await supabase
    .from('image_assets')
    .select('image_url')
    .eq('entity_type', 'recipe')
    .eq('entity_id', recipe.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return data?.image_url ?? null
}

export const getGuidesV3DeckDetail = cache(
  async (deckId: string, userId: string) => {
    const supabase = await createClient()

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('id, name, description, image_url, is_public, user_id')
      .eq('id', deckId)
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .maybeSingle()

    if (recipeError) throw new Error(recipeError.message)
    if (!recipe) return null

    const typedRecipe = recipe as RecipeRow
    const [{ data: steps, error: stepsError }, rawImage] = await Promise.all([
      supabase
        .from('recipe_steps')
        .select('id, step_number, title, instructions, image_url')
        .eq('recipe_id', deckId)
        .order('step_number', { ascending: true }),
      loadRecipeImage(supabase, typedRecipe),
    ])

    if (stepsError) throw new Error(stepsError.message)

    const typedSteps = (steps ?? []) as StepRow[]
    const stepIds = typedSteps.map((step) => step.id)
    const { data: stepPaintLinks, error: stepPaintError } =
      stepIds.length > 0
        ? await supabase
            .from('recipe_step_paints')
            .select(
              `
              recipe_step_id,
              paint_source,
              catalog_paint:paint_catalog_id (
                id,
                brand,
                line,
                name,
                hex_approx
              ),
              custom_paint:custom_paint_id (
                id,
                name,
                manufacturer,
                series,
                color_hex
              )
            `
            )
            .in('recipe_step_id', stepIds)
        : { data: [], error: null }

    if (stepPaintError) throw new Error(stepPaintError.message)

    const paintsById = new Map<string, GuidesV3DeckPaint>()
    for (const link of (stepPaintLinks ?? []) as StepPaintRow[]) {
      const catalogPaint = firstValue(link.catalog_paint)
      const customPaint = firstValue(link.custom_paint)

      if (catalogPaint) {
        paintsById.set(`catalog:${catalogPaint.id}`, {
          id: `catalog:${catalogPaint.id}`,
          name: clean(catalogPaint.name, 'Unnamed Paint'),
          brand: clean(catalogPaint.brand, 'Catalog'),
          line: clean(catalogPaint.line, 'Paint'),
          color: catalogPaint.hex_approx || '#17b9c2',
        })
      } else if (customPaint) {
        paintsById.set(`custom:${customPaint.id}`, {
          id: `custom:${customPaint.id}`,
          name: clean(customPaint.name, 'Custom Paint'),
          brand: clean(customPaint.manufacturer, 'Custom'),
          line: clean(customPaint.series, 'Mix'),
          color: customPaint.color_hex || '#d8bd83',
        })
      }
    }

    const paints = Array.from(paintsById.values())

    return {
      id: typedRecipe.id,
      title: clean(typedRecipe.name, 'Untitled Deck'),
      category: categoryFor(typedRecipe),
      cards: typedSteps.length,
      paints: paints.length,
      usedIn: 0,
      image: getGuideDeckThumbnail(rawImage, fallbackImage),
      saved: typedRecipe.user_id === userId,
      accent: accentFor(typedRecipe.id),
      description: clean(
        typedRecipe.description,
        'No description has been added to this deck yet.'
      ),
      isPublic: typedRecipe.is_public === true,
      ownerLabel: typedRecipe.user_id === userId ? 'Created by you' : 'Public deck',
      steps: typedSteps.map((step, index) => ({
        id: step.id,
        number: step.step_number ?? index + 1,
        title: clean(step.title, `Card ${index + 1}`),
        instructions: clean(step.instructions, 'No instructions yet.'),
        image: step.image_url ? getGuideDeckThumbnail(step.image_url, fallbackImage) : null,
      })),
      paintList: paints,
    } satisfies GuidesV3DeckDetail
  }
)

export const getGuidesV3GuideDetail = cache(
  async (guideId: string, userId: string) => {
    const payload = await getGuidesV3Payload(userId)
    const allGuides = [...payload.guideFiles, ...payload.libraryGuides]
    const guide = allGuides.find((item) => item.id === guideId)

    if (!guide) return null

    const deckId = guideId.startsWith('public-guide-')
      ? guideId.replace('public-guide-', '')
      : null
    const decksList = deckId
      ? payload.libraryDecks.filter((deck) => deck.id === deckId)
      : payload.decks

    return {
      ...guide,
      decksList,
    } satisfies GuidesV3GuideDetail
  }
)
