import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'

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
  // The single deck (recipe) this guide currently wraps. Every guide wraps
  // exactly one deck for now (multi-deck guides are a later phase), so this
  // is always populated for a real `guides` row. Optional/additive so any
  // pre-existing consumer that only reads the original fields is unaffected.
  deckId?: string
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  createdAt: string
}

export type GuidesV3Deck = {
  id: string
  title: string
  category: string
  cards: number
  paints: number
  usedIn: number
  image: string
  // Whether the viewer bookmarked or otherwise has this deck in their own
  // collection - NOT the same as ownership. A saved (bookmarked) deck can
  // belong to someone else entirely; see `isOwner` for the actual
  // creator/editor check.
  saved: boolean
  // The only thing that should ever gate edit access. True iff the viewer
  // is the deck's creator (recipes.user_id === viewer's user id).
  isOwner: boolean
  accent: string
  createdAt: string
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

type GuideDeckJoinRow = {
  recipe_id: string
  position: number | null
  recipes?: RecipeRow | RecipeRow[] | null
}

type GuideRow = {
  id: string
  user_id: string
  title: string | null
  is_auto: boolean | null
  created_at: string | null
  guide_decks?: GuideDeckJoinRow[] | null
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
const accents = [
  '#d8bd83',
  '#d29631',
  '#17b9c2',
  '#7a5d37',
  '#1e4f92',
  '#5943a7',
]

// Shared select shape for a guide plus its member decks (recipes). Every
// guide wraps exactly one deck today, but this embeds the full membership so
// visibility can be asserted in application code (see isGuidePublic below)
// rather than trusted purely to RLS.
const guideWithDecksSelect = `
  id,
  user_id,
  title,
  is_auto,
  created_at,
  guide_decks (
    recipe_id,
    position,
    recipes (
      id,
      name,
      description,
      image_url,
      is_public,
      created_at,
      user_id
    )
  )
`

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
    // Route straight through Supabase's own image-transform endpoint
    // (already allow-listed via next.config.ts remotePatterns) rather than
    // our own /api/guides/v3-thumbnail proxy - next/image invokes a local
    // route's handler in-process instead of over the network, and that
    // path was returning a response its own image-type sniffing rejected.
    return (
      getSupabaseImageUrl(url.toString(), {
        width: 112,
        height: 112,
        quality: 58,
        resize: 'cover',
      }) ?? fallback
    )
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

// A guide's public visibility is derived (not stored): it's publicly visible
// if any member deck's recipe is public. RLS on `guides`/`guide_decks`
// already enforces this at the DB layer for anyone who isn't the owner; this
// re-asserts it in application code so an owner's own private/draft guides
// (visible to them via RLS's "own" clause) never leak into a public listing.
function memberRecipesOf(guide: GuideRow): RecipeRow[] {
  return (guide.guide_decks ?? [])
    .map((guideDeck) => firstValue(guideDeck.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))
}

function isGuidePublic(guide: GuideRow) {
  return memberRecipesOf(guide).some((recipe) => recipe.is_public === true)
}

// Every guide today wraps exactly one deck (multi-deck guides are a later
// phase), so "the" wrapped recipe is just the guide's single member -
// preferring a public member if one exists.
function primaryRecipeOf(guide: GuideRow): RecipeRow | null {
  const members = memberRecipesOf(guide)
  return members.find((recipe) => recipe.is_public === true) ?? members[0] ?? null
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
    statsByRecipeId.set(recipeId, { cards: 1, paintIds: new Set() })
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

async function loadRecipeSocialCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipeIds: string[],
  userId: string
) {
  const emptyState = () => ({
    likeCount: 0,
    saveCount: 0,
    viewerHasLiked: false,
    viewerHasSaved: false,
  })

  if (recipeIds.length === 0) {
    return new Map<string, ReturnType<typeof emptyState>>()
  }

  const [likeRowsResult, saveRowsResult, viewerLikeRowsResult, viewerSaveRowsResult] =
    await Promise.all([
      supabase.from('recipe_likes').select('recipe_id').in('recipe_id', recipeIds),
      supabase.from('saved_recipes').select('recipe_id').in('recipe_id', recipeIds),
      supabase
        .from('recipe_likes')
        .select('recipe_id')
        .eq('user_id', userId)
        .in('recipe_id', recipeIds),
      supabase
        .from('saved_recipes')
        .select('recipe_id')
        .eq('user_id', userId)
        .in('recipe_id', recipeIds),
    ])

  if (likeRowsResult.error) throw new Error(likeRowsResult.error.message)
  if (saveRowsResult.error) throw new Error(saveRowsResult.error.message)
  if (viewerLikeRowsResult.error) throw new Error(viewerLikeRowsResult.error.message)
  if (viewerSaveRowsResult.error) throw new Error(viewerSaveRowsResult.error.message)

  const countsByRecipeId = new Map<string, ReturnType<typeof emptyState>>()
  function ensure(recipeId: string) {
    let entry = countsByRecipeId.get(recipeId)
    if (!entry) {
      entry = emptyState()
      countsByRecipeId.set(recipeId, entry)
    }
    return entry
  }

  for (const row of (likeRowsResult.data ?? []) as { recipe_id: string }[]) {
    ensure(row.recipe_id).likeCount += 1
  }
  for (const row of (saveRowsResult.data ?? []) as { recipe_id: string }[]) {
    ensure(row.recipe_id).saveCount += 1
  }
  for (const row of (viewerLikeRowsResult.data ?? []) as { recipe_id: string }[]) {
    ensure(row.recipe_id).viewerHasLiked = true
  }
  for (const row of (viewerSaveRowsResult.data ?? []) as { recipe_id: string }[]) {
    ensure(row.recipe_id).viewerHasSaved = true
  }

  return countsByRecipeId
}

function toDeck({
  imageByRecipeId,
  recipe,
  saved,
  statsByRecipeId,
  userId,
}: {
  imageByRecipeId: Map<string, string>
  recipe: RecipeRow
  saved: boolean
  statsByRecipeId: Map<string, { cards: number; paints: number }>
  userId: string
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
    isOwner: recipe.user_id === userId,
    accent: accentFor(recipe.id),
    createdAt: recipe.created_at ?? '',
  }
}

// Builds a real Guide File from a `guides` row plus the recipe/deck it
// wraps. `guides.title` is populated at creation time (see the
// `add_guides` migration - both the backfill and the `ensure_guide_for_
// public_recipe` trigger set `title` to the recipe's name), so the
// deck-name fallback below is defensive rather than the common path.
function toGuideFile(
  guide: GuideRow,
  recipe: RecipeRow,
  deck: GuidesV3Deck,
  socialByRecipeId: Map<
    string,
    { likeCount: number; saveCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean }
  >
): GuidesV3GuideFile {
  const social = socialByRecipeId.get(deck.id)

  return {
    id: guide.id,
    title: cleanText(guide.title, `${deck.title} Guide`),
    subtitle: formatSubtitle(recipe, 'Public guide assembled around this deck.'),
    image: deck.image,
    decks: 1,
    cards: deck.cards,
    level: deck.cards > 5 ? 'Intermediate' : 'Beginner',
    ownedPercent: 0,
    palette: [deck.accent, '#111417', '#d8bd83', '#17b9c2'],
    deckId: deck.id,
    likeCount: social?.likeCount ?? 0,
    saveCount: social?.saveCount ?? 0,
    viewerHasLiked: social?.viewerHasLiked ?? false,
    viewerHasSaved: social?.viewerHasSaved ?? false,
    createdAt: guide.created_at ?? '',
  }
}

export const getGuidesV3Payload = cache(async (userId: string) => {
  const supabase = await createClient()

  const [myRecipesResult, savedRowsResult, publicGuidesResult, myGuidesResult] =
    await Promise.all([
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
      // Public library: RLS on `guides` already restricts selects to "own
      // or has a public member deck", so this is effectively "every guide
      // with at least one public deck, plus my own (possibly private)
      // guides" - the isGuidePublic() filter below removes the latter.
      supabase
        .from('guides')
        .select(guideWithDecksSelect)
        .order('created_at', { ascending: false })
        .limit(publicDeckLimit),
      // My Guides: guides I own (draft/private/public alike, per RLS's
      // "own" clause).
      supabase
        .from('guides')
        .select(guideWithDecksSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(deckLimit),
    ])

  if (myRecipesResult.error) throw new Error(myRecipesResult.error.message)
  if (savedRowsResult.error) throw new Error(savedRowsResult.error.message)
  if (publicGuidesResult.error) throw new Error(publicGuidesResult.error.message)
  if (myGuidesResult.error) throw new Error(myGuidesResult.error.message)

  const myRecipes = (myRecipesResult.data ?? []) as RecipeRow[]
  const savedRows = (savedRowsResult.data ?? []) as SavedRecipeRow[]
  const savedRecipes = savedRows
    .map((row) => firstValue(row.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))
  const savedRecipeIds = new Set(savedRows.map((row) => row.recipe_id))
  const ownedRecipeIds = new Set(myRecipes.map((recipe) => recipe.id))

  const publicGuides = ((publicGuidesResult.data ?? []) as GuideRow[]).filter(
    isGuidePublic
  )
  const ownedGuides = ((myGuidesResult.data ?? []) as GuideRow[]).filter(
    (guide) => guide.user_id === userId
  )

  // Saved guides: guides reachable via a deck (recipe) the user has
  // bookmarked. `guide_decks!inner` narrows both the parent `guides` rows
  // and the embedded `guide_decks` rows to those matching the saved recipe
  // ids, per PostgREST's embedded-filter semantics.
  const savedRecipeIdList = Array.from(savedRecipeIds)
  const savedGuidesResult =
    savedRecipeIdList.length > 0
      ? await supabase
          .from('guides')
          .select(
            `
            id,
            user_id,
            title,
            is_auto,
            created_at,
            guide_decks!inner (
              recipe_id,
              position,
              recipes (
                id,
                name,
                description,
                image_url,
                is_public,
                created_at,
                user_id
              )
            )
          `
          )
          .in('guide_decks.recipe_id', savedRecipeIdList)
          .order('created_at', { ascending: false })
      : { data: [] as GuideRow[], error: null }

  if (savedGuidesResult.error) throw new Error(savedGuidesResult.error.message)

  // A saved deck can only ever be one the user could already see when they
  // saved it (own, or public per `recipes`' own RLS) - re-assert that here
  // rather than trusting it blindly.
  const savedGuides = ((savedGuidesResult.data ?? []) as GuideRow[]).filter(
    (guide) => guide.user_id === userId || isGuidePublic(guide)
  )

  const myGuideById = new Map<string, GuideRow>()
  for (const guide of ownedGuides) myGuideById.set(guide.id, guide)
  for (const guide of savedGuides) {
    if (!myGuideById.has(guide.id)) myGuideById.set(guide.id, guide)
  }
  const myGuides = Array.from(myGuideById.values())

  const deckRecipeMap = new Map<string, RecipeRow>()
  for (const recipe of myRecipes) {
    deckRecipeMap.set(recipe.id, recipe)
  }
  for (const recipe of savedRecipes) {
    if (!deckRecipeMap.has(recipe.id)) deckRecipeMap.set(recipe.id, recipe)
  }
  const deckRecipes = Array.from(deckRecipeMap.values()).slice(0, deckLimit)

  const publicRecipeByGuideId = new Map<string, RecipeRow>()
  for (const guide of publicGuides) {
    const recipe = primaryRecipeOf(guide)
    if (recipe) publicRecipeByGuideId.set(guide.id, recipe)
  }

  const myGuideRecipeByGuideId = new Map<string, RecipeRow>()
  for (const guide of myGuides) {
    const recipe = primaryRecipeOf(guide)
    if (recipe) myGuideRecipeByGuideId.set(guide.id, recipe)
  }

  const allRecipesForStats = Array.from(
    new Map(
      [
        ...deckRecipes,
        ...Array.from(publicRecipeByGuideId.values()),
        ...Array.from(myGuideRecipeByGuideId.values()),
      ].map((recipe) => [recipe.id, recipe])
    ).values()
  )

  const allRecipeIdsForStats = allRecipesForStats.map((recipe) => recipe.id)
  const [statsByRecipeId, imageByRecipeId, socialByRecipeId] = await Promise.all([
    loadRecipeStats(supabase, allRecipeIdsForStats),
    loadRecipeImages(supabase, allRecipesForStats),
    loadRecipeSocialCounts(supabase, allRecipeIdsForStats, userId),
  ])

  const decks = deckRecipes.map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: true,
      statsByRecipeId,
      userId,
    })
  )

  const libraryDecks = Array.from(publicRecipeByGuideId.values()).map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: savedRecipeIds.has(recipe.id) || ownedRecipeIds.has(recipe.id),
      statsByRecipeId,
      userId,
    })
  )
  const libraryDeckById = new Map(libraryDecks.map((deck) => [deck.id, deck]))

  const libraryGuides = publicGuides
    .map((guide) => {
      const recipe = publicRecipeByGuideId.get(guide.id)
      const deck = recipe ? libraryDeckById.get(recipe.id) : undefined
      return recipe && deck ? toGuideFile(guide, recipe, deck, socialByRecipeId) : null
    })
    .filter((guide): guide is GuidesV3GuideFile => Boolean(guide))

  const guideFiles = myGuides
    .map((guide) => {
      const recipe = myGuideRecipeByGuideId.get(guide.id)
      if (!recipe) return null
      const deck = toDeck({
        imageByRecipeId,
        recipe,
        saved: true,
        statsByRecipeId,
        userId,
      })
      return toGuideFile(guide, recipe, deck, socialByRecipeId)
    })
    .filter((guide): guide is GuidesV3GuideFile => Boolean(guide))

  return {
    guideFiles,
    decks,
    libraryGuides,
    libraryDecks,
    savedDeckIds: Array.from(
      new Set([...savedRecipeIds, ...ownedRecipeIds])
    ),
  } satisfies GuidesV3Payload
})
