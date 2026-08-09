import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'

export type GuidesV3GuideFile = {
  id: string
  title: string
  subtitle: string
  image: string
  decks: number
  cards: number
  level: string
  ownedPercent: number
  palette: string[]
}

export type GuidesV3Deck = {
  id: string
  title: string
  category: string
  cards: number
  paints: number
  usedIn: number
  image: string
  saved: boolean
  accent: string
}

export type GuidesV3Payload = {
  guideFiles: GuidesV3GuideFile[]
  decks: GuidesV3Deck[]
  libraryGuides: GuidesV3GuideFile[]
  libraryDecks: GuidesV3Deck[]
  savedDeckIds: string[]
}

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

type RecipeStepRow = {
  id: string
  recipe_id: string
}

type RecipeStepPaintRow = {
  recipe_step_id: string
  paint_catalog_id: string | null
  custom_paint_id: string | null
}

const deckLimit = 36
const publicDeckLimit = 36
const fallbackImage = '/onboarding/pains/tough-choices.jpeg'
const fallbackGuideImage = '/onboarding/pains/paint-management.jpeg'
const accents = [
  '#d8bd83',
  '#d29631',
  '#17b9c2',
  '#7a5d37',
  '#1e4f92',
  '#5943a7',
]

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function cleanText(value: string | null | undefined, fallback: string) {
  const cleanValue = value?.trim()
  return cleanValue || fallback
}

function safeLocalImage(value: string | null | undefined, fallback: string) {
  return value?.startsWith('/') ? value : fallback
}

export function getGuideDeckThumbnail(
  value: string | null | undefined,
  fallback = fallbackImage
) {
  if (!value) return fallback
  if (value.startsWith('/')) return value
  try {
    const url = new URL(value)
    return `/api/guides/v3-thumbnail?src=${encodeURIComponent(url.toString())}`
  } catch {
    return safeLocalImage(value, fallback)
  }
}

function accentFor(seed: string) {
  const index =
    seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    accents.length

  return accents[index] ?? accents[0]
}

function inferCategory(recipe: RecipeRow) {
  const haystack = `${recipe.name ?? ''} ${recipe.description ?? ''}`.toLowerCase()

  if (haystack.includes('base')) return 'Basing'
  if (haystack.includes('bone') || haystack.includes('skeleton')) return 'Bone'
  if (haystack.includes('gold')) return 'Gold'
  if (haystack.includes('metal') || haystack.includes('brass')) return 'Metal'
  if (haystack.includes('armor') || haystack.includes('armour')) return 'Armor'
  if (haystack.includes('weather') || haystack.includes('rust')) return 'Weathering'
  return 'Technique'
}

function formatSubtitle(recipe: RecipeRow, sourceLabel: string) {
  return cleanText(recipe.description, sourceLabel)
}

async function loadRecipeImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipes: RecipeRow[]
) {
  const missingImageIds = recipes
    .filter((recipe) => !recipe.image_url)
    .map((recipe) => recipe.id)

  if (missingImageIds.length === 0) return new Map<string, string>()

  const { data, error } = await supabase
    .from('image_assets')
    .select('entity_id, image_url')
    .eq('entity_type', 'recipe')
    .in('entity_id', missingImageIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const imageByRecipeId = new Map<string, string>()
  for (const image of data ?? []) {
    if (!imageByRecipeId.has(image.entity_id)) {
      imageByRecipeId.set(image.entity_id, image.image_url)
    }
  }

  return imageByRecipeId
}

async function loadRecipeStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeIds: string[]
) {
  if (recipeIds.length === 0) {
    return new Map<string, { cards: number; paints: number }>()
  }

  const { data: steps, error: stepsError } = await supabase
    .from('recipe_steps')
    .select('id, recipe_id')
    .in('recipe_id', recipeIds)

  if (stepsError) throw new Error(stepsError.message)

  const stepRows = (steps ?? []) as RecipeStepRow[]
  const stepToRecipeId = new Map(stepRows.map((step) => [step.id, step.recipe_id]))
  const statsByRecipeId = new Map<string, { cards: number; paintIds: Set<string> }>()

  for (const recipeId of recipeIds) {
    statsByRecipeId.set(recipeId, { cards: 0, paintIds: new Set() })
  }

  for (const step of stepRows) {
    const stats = statsByRecipeId.get(step.recipe_id)
    if (stats) stats.cards += 1
  }

  const stepIds = stepRows.map((step) => step.id)
  const { data: stepPaints, error: stepPaintsError } =
    stepIds.length > 0
      ? await supabase
          .from('recipe_step_paints')
          .select('recipe_step_id, paint_catalog_id, custom_paint_id')
          .in('recipe_step_id', stepIds)
      : { data: [], error: null }

  if (stepPaintsError) throw new Error(stepPaintsError.message)

  for (const link of (stepPaints ?? []) as RecipeStepPaintRow[]) {
    const recipeId = stepToRecipeId.get(link.recipe_step_id)
    if (!recipeId) continue

    const paintId = link.paint_catalog_id
      ? `catalog:${link.paint_catalog_id}`
      : link.custom_paint_id
        ? `custom:${link.custom_paint_id}`
        : null

    if (paintId) {
      statsByRecipeId.get(recipeId)?.paintIds.add(paintId)
    }
  }

  return new Map(
    Array.from(statsByRecipeId.entries()).map(([recipeId, stats]) => [
      recipeId,
      {
        cards: stats.cards,
        paints: stats.paintIds.size,
      },
    ])
  )
}

function toDeck({
  imageByRecipeId,
  recipe,
  saved,
  statsByRecipeId,
}: {
  imageByRecipeId: Map<string, string>
  recipe: RecipeRow
  saved: boolean
  statsByRecipeId: Map<string, { cards: number; paints: number }>
}): GuidesV3Deck {
  const stats = statsByRecipeId.get(recipe.id)

  return {
    id: recipe.id,
    title: cleanText(recipe.name, 'Untitled Deck'),
    category: inferCategory(recipe),
    cards: stats?.cards ?? 0,
    paints: stats?.paints ?? 0,
    usedIn: 0,
    image: getGuideDeckThumbnail(
      recipe.image_url || imageByRecipeId.get(recipe.id),
      fallbackImage
    ),
    saved,
    accent: accentFor(recipe.id),
  }
}

function toPublicGuideFile(deck: GuidesV3Deck, recipe: RecipeRow): GuidesV3GuideFile {
  return {
    id: `public-guide-${recipe.id}`,
    title: `${deck.title} Guide`,
    subtitle: formatSubtitle(recipe, 'Public guide assembled around this deck.'),
    image: deck.image,
    decks: 1,
    cards: deck.cards,
    level: deck.cards > 5 ? 'Intermediate' : 'Beginner',
    ownedPercent: 0,
    palette: [deck.accent, '#111417', '#d8bd83', '#17b9c2'],
  }
}

function buildGuideCollections(decks: GuidesV3Deck[]) {
  if (decks.length === 0) return []

  const createdDecks = decks.filter((deck) => deck.saved)
  const cards = decks.reduce((sum, deck) => sum + deck.cards, 0)
  const firstDeck = decks[0]

  return [
    {
      id: 'my-deck-collection',
      title: 'My Deck Collection',
      subtitle: 'A live guide file assembled from your saved and created decks.',
      image: firstDeck?.image ?? fallbackGuideImage,
      decks: decks.length,
      cards,
      level: decks.some((deck) => deck.cards > 5) ? 'Intermediate' : 'Beginner',
      ownedPercent: createdDecks.length ? 100 : 72,
      palette: decks.slice(0, 5).map((deck) => deck.accent),
    },
  ] satisfies GuidesV3GuideFile[]
}

export const getGuidesV3Payload = cache(async (userId: string) => {
  const supabase = await createClient()

  const [myRecipesResult, savedRowsResult, publicRecipesResult] = await Promise.all([
    supabase
      .from('recipes')
      .select('id, name, description, image_url, is_public, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(deckLimit),
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
      .eq('user_id', userId)
      .limit(deckLimit),
    supabase
      .from('recipes')
      .select('id, name, description, image_url, is_public, created_at, user_id')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(publicDeckLimit),
  ])

  if (myRecipesResult.error) throw new Error(myRecipesResult.error.message)
  if (savedRowsResult.error) throw new Error(savedRowsResult.error.message)
  if (publicRecipesResult.error) throw new Error(publicRecipesResult.error.message)

  const myRecipes = (myRecipesResult.data ?? []) as RecipeRow[]
  const savedRows = (savedRowsResult.data ?? []) as SavedRecipeRow[]
  const savedRecipes = savedRows
    .map((row) => firstValue(row.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))
  const publicRecipes = (publicRecipesResult.data ?? []) as RecipeRow[]
  const savedRecipeIds = new Set(savedRows.map((row) => row.recipe_id))
  const ownedRecipeIds = new Set(myRecipes.map((recipe) => recipe.id))
  const deckRecipeMap = new Map<string, RecipeRow>()

  for (const recipe of myRecipes) {
    deckRecipeMap.set(recipe.id, recipe)
  }

  for (const recipe of savedRecipes) {
    if (!deckRecipeMap.has(recipe.id)) deckRecipeMap.set(recipe.id, recipe)
  }

  const deckRecipes = Array.from(deckRecipeMap.values()).slice(0, deckLimit)
  const allRecipesForStats = Array.from(
    new Map(
      [...deckRecipes, ...publicRecipes].map((recipe) => [recipe.id, recipe])
    ).values()
  )
  const [statsByRecipeId, imageByRecipeId] = await Promise.all([
    loadRecipeStats(
      supabase,
      allRecipesForStats.map((recipe) => recipe.id)
    ),
    loadRecipeImages(supabase, allRecipesForStats),
  ])

  const decks = deckRecipes.map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: true,
      statsByRecipeId,
    })
  )
  const libraryDecks = publicRecipes.map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: savedRecipeIds.has(recipe.id) || ownedRecipeIds.has(recipe.id),
      statsByRecipeId,
    })
  )

  return {
    guideFiles: buildGuideCollections(decks),
    decks,
    libraryGuides: publicRecipes
      .slice(0, 8)
      .map((recipe) => {
        const deck = libraryDecks.find((item) => item.id === recipe.id)
        return deck ? toPublicGuideFile(deck, recipe) : null
      })
      .filter((guide): guide is GuidesV3GuideFile => Boolean(guide)),
    libraryDecks,
    savedDeckIds: Array.from(
      new Set([...savedRecipeIds, ...ownedRecipeIds])
    ),
  } satisfies GuidesV3Payload
})
