import { selectDifficultyCompatible } from './select-difficulty-compatible'
import { guideDifficulty } from './shared/guide-difficulty'
import { allowsGuideShareLink, guideVisibilityOf, type GuideVisibility } from './shared/guide-visibility'
import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { selectCreatorCollection } from './shared/creator-collection'
import { withoutNestedAutoGuides } from './shared/guide-listing'
import { socialDeckIdOf } from './shared/guide-social-deck'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { createSharedReadClient } from './shared-read-client'

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
  // The "primary" deck this guide's social state (like/save) is keyed to -
  // its pinned guides.primary_recipe_id, falling back to its first member
  // (likes/saves stay recipe-scoped, not guide-scoped, so a multi-deck
  // guide's heart/bookmark act on this one). See socialDeckIdOf.
  // Optional so any pre-existing consumer that only reads the original
  // fields is unaffected.
  deckId?: string
  // Every member deck's id, in guide_decks.position order. Used to resolve
  // the guide's full deck list (e.g. for the guide detail page and editor).
  deckIds: string[]
  // The owner's chosen difficulty, persisted on guides.difficulty - see
  // GuidesV3Deck.difficulty for why this can be null.
  difficulty: string | null
  // True iff the viewer is the guide's creator (guides.user_id === viewer).
  // The only thing that should ever gate editing a guide.
  isOwner: boolean
  likeCount: number
  saveCount: number
  viewerHasLiked: boolean
  viewerHasSaved: boolean
  createdAt: string
  tags?: string[]
  // Set on the viewer's own untouched auto-guide: the id of the deck it
  // only mirrors, so My Guides can list that deck once (my-guides-items.ts).
  mirrorsDeckId?: string
  // Public creator identity, shown on Discover cards. Only the username and
  // avatar are exposed - display_name can hold a real name.
  creator?: GuidesV3Creator
  // guides.visibility: only 'public' guides are listed anywhere public.
  visibility?: GuideVisibility
}

export type GuidesV3Creator = {
  username: string
  avatar: string | null
  // The creator page listing all of their public guides.
  href: string
}

export type GuidesV3Deck = {
  id: string
  title: string
  category: string
  cards: number
  paints: number
  usedIn: number
  image: string
  // The owner's chosen difficulty, persisted on recipes.difficulty. Null
  // for a deck whose creator never set one (or one created before this
  // field existed) - the editor falls back to an inferred value in that
  // case rather than showing a blank select.
  difficulty: string | null
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
  // Set when this deck is some guide's own cards (recipes.inline_guide_id).
  inlineGuideId?: string | null
  // True only in the context of that guide (see forGuide in guide-card-layout).
  isInline?: boolean
  description?: string
  likeCount?: number
  saveCount?: number
  viewerHasLiked?: boolean
  viewerHasSaved?: boolean
}

export type GuidesV3Payload = {
  guideFiles: GuidesV3GuideFile[]
  decks: GuidesV3Deck[]
  // Everything the viewer can reuse inside another guide: their decks plus
  // the own cards of their guides (titled by the guide).
  nestableDecks: GuidesV3Deck[]
  libraryGuides: GuidesV3GuideFile[]
  libraryDecks: GuidesV3Deck[]
  savedDeckIds: string[]
}

export type GuidesV3Tab = 'library' | 'guides' | 'decks'

type RecipeRow = {
  // Set on a guide's inline deck (the home of its direct cards); see isInlineDeckOf.
  inline_guide_id?: string | null
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
  difficulty: string | null
  created_at: string | null
  user_id: string | null
}

type SavedRecipeRow = {
  recipe_id: string
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
  description: string | null
  image_url: string | null
  difficulty: string | null
  is_auto: boolean | null
  visibility?: string | null
  primary_recipe_id?: string | null
  created_at: string | null
  tags?: string[] | null
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

const fallbackImage = '/onboarding/pains/tough-choices.jpeg'
const accents = [
  '#d8bd83',
  '#d29631',
  '#17b9c2',
  '#7a5d37',
  '#1e4f92',
  '#5943a7',
]

// Shared select shape for a guide plus all of its member decks (recipes),
// so visibility can be asserted in application code (see isGuidePublic
// below) rather than trusted purely to RLS, and so multi-deck guides can be
// fully assembled without a second round trip.
const guideWithDecksSelect = `
  id,
  user_id,
  title,
  description,
  image_url,
  difficulty,
  tags,
  is_auto,
  visibility,
  primary_recipe_id,
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
      difficulty,
      inline_guide_id,
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
  // PostgREST doesn't order embedded rows, so sort explicitly: the first
  // member is the deck a guide's likes/saves are keyed to, and an unstable
  // order showed a multi-deck guide's counts for an arbitrary member.
  return [...(guide.guide_decks ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((guideDeck) => firstValue(guideDeck.recipes))
    .filter((recipe): recipe is RecipeRow => Boolean(recipe))
}

// The deck a guide's like/save are keyed to, exactly as toGuideFile sets
// GuidesV3GuideFile.deckId (see socialDeckIdOf).
function primaryRecipeOf(guide: GuideRow, recipes: RecipeRow[]): RecipeRow | undefined {
  const id = socialDeckIdOf(guide.primary_recipe_id, recipes.map((recipe) => recipe.id))
  return recipes.find((recipe) => recipe.id === id)
}

// A recipe is a guide's inline deck only when both belong to the same user
// (see recipes_inline_guide_owner_idx).
function isInlineDeckOf(guide: Pick<GuideRow, 'id' | 'user_id'>, recipe: Pick<RecipeRow, 'inline_guide_id' | 'user_id'>) {
  return recipe.inline_guide_id === guide.id && recipe.user_id === guide.user_id
}

// Listed publicly: the owner published the guide (guides.visibility) and it
// has public content to show.
function isGuidePublic(guide: GuideRow) {
  return guide.visibility === 'public' && hasPublicContent(guide)
}

// Readable by people other than the owner. A guide pulled back to private or
// draft keeps its public decks, so the people who saved or assigned it still
// see it - it just isn't listed anywhere.
function hasPublicContent(guide: GuideRow) {
  return memberRecipesOf(guide).some((recipe) => recipe.is_public === true)
}

// Publishing a user-composed guide flips its decks to public, and the
// `recipes_ensure_guide` trigger then gives each of those decks its own
// auto-guide. Listing both would show the same content twice, so an
// auto-guide is dropped whenever a composed guide in the same list already
// covers one of its decks. A deck published on its own has only its
// auto-guide and still appears once.
function withoutRedundantAutoGuides(guides: GuideRow[]) {
  const composedDeckIds = new Set(
    guides
      .filter((guide) => !guide.is_auto)
      .flatMap((guide) => (guide.guide_decks ?? []).map((deck) => deck.recipe_id))
  )
  return guides.filter(
    (guide) =>
      !guide.is_auto ||
      !(guide.guide_decks ?? []).some((deck) => composedDeckIds.has(deck.recipe_id))
  )
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Runs an `.in(column, ids)` lookup in batches. Discover now loads every
// public guide, so a single request could carry hundreds of ids (too long a
// URL) and return more rows than PostgREST's per-request cap.
const inQueryBatchSize = 50

async function selectInBatches<Row>(
  ids: string[],
  query: (batch: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
): Promise<Row[]> {
  const rows: Row[] = []
  for (let start = 0; start < ids.length; start += inQueryBatchSize) {
    const { data, error } = await query(ids.slice(start, start + inQueryBatchSize))
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
  }
  return rows
}

// My Guides and Saved list everything the viewer owns or saved: a fixed cap
// (36) once hid a big creator's older guides, and folders now organize long
// lists anyway. Pages stay under PostgREST's per-request row limit; the
// ceiling only guards against a runaway loop.
const ownListPageSize = 500
const maxOwnListRows = 10000

async function loadAllPages<Row>(
  query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
): Promise<{ data: Row[] | null; error: { message: string } | null }> {
  const rows: Row[] = []
  for (let offset = 0; offset < maxOwnListRows; offset += ownListPageSize) {
    const { data, error } = await query(offset, offset + ownListPageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if ((data ?? []).length < ownListPageSize) break
  }
  return { data: rows, error: null }
}

// Discover lists every public guide. Only fetching the newest N rows hid
// older guides entirely, and N shrank further once private drafts and
// redundant auto-guides were filtered out of it, so page through them all.
const publicGuidePageSize = 100
const maxPublicGuideRows = 2000

async function loadAllVisibleGuideRows(supabase: SupabaseClient) {
  const rows: GuideRow[] = []
  for (let offset = 0; offset < maxPublicGuideRows; offset += publicGuidePageSize) {
    const { data, error } = await selectDifficultyCompatible(guideWithDecksSelect, selection => supabase
      .from('guides')
      .select(selection)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + publicGuidePageSize - 1)
      .returns<GuideRow[]>())
    if (error) return { data: null, error }
    rows.push(...((data ?? []) as GuideRow[]))
    if ((data ?? []).length < publicGuidePageSize) break
  }
  return { data: rows, error: null }
}

// The composed guides containing each listed auto-guide's deck. A parent that
// is private (or another owner's) is hidden by RLS, yet still makes the deck
// a building block, so read just these ids with the service role.
async function composedGuideIdsByDeck(guides: GuideRow[]) {
  const byDeck = new Map<string, Set<string>>()
  const deckIds = Array.from(new Set(
    guides.filter((guide) => guide.is_auto).flatMap((guide) => (guide.guide_decks ?? []).map((deck) => deck.recipe_id))
  ))
  if (!deckIds.length) return byDeck
  const service = createServiceRoleClient()
  const rows = await selectInBatches<{ recipe_id: string; guide_id: string; guides: { is_auto: boolean | null } | { is_auto: boolean | null }[] | null }>(
    deckIds,
    (batch) => service.from('guide_decks').select('recipe_id, guide_id, guides!inner(is_auto)').in('recipe_id', batch)
  )
  for (const row of rows) {
    if (firstValue(row.guides)?.is_auto) continue
    const parents = byDeck.get(row.recipe_id) ?? new Set<string>()
    parents.add(row.guide_id)
    byDeck.set(row.recipe_id, parents)
  }
  return byDeck
}

// Profiles are private under RLS, so read just the public username and
// avatar for the creators of guides the viewer can already see.
async function loadGuideCreators(userIds: string[]) {
  const creatorsById = new Map<string, GuidesV3Creator>()
  const ids = Array.from(new Set(userIds))
  if (ids.length === 0) return creatorsById

  const service = createServiceRoleClient()
  const rows = await selectInBatches<{ id: string; username: string | null; avatar_url: string | null }>(
    ids,
    (batch) => service.from('profiles').select('id, username, avatar_url').in('id', batch)
  )
  for (const row of rows) {
    if (!row.username) continue
    creatorsById.set(row.id, {
      username: row.username,
      avatar: getSupabaseImageUrl(row.avatar_url, { width: 64, height: 64, quality: 60, resize: 'cover' }),
      href: `/guides/creators/${row.id}`,
    })
  }
  return creatorsById
}

async function loadRecipeImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recipes: RecipeRow[]
) {
  const missingImageIds = recipes
    .filter((recipe) => !recipe.image_url)
    .map((recipe) => recipe.id)

  if (missingImageIds.length === 0) return new Map<string, string>()

  const data = await selectInBatches<{ entity_id: string; image_url: string }>(
    missingImageIds,
    (batch) => supabase
      .from('image_assets')
      .select('entity_id, image_url')
      .eq('entity_type', 'recipe')
      .in('entity_id', batch)
      .order('created_at', { ascending: false })
  )

  const imageByRecipeId = new Map<string, string>()
  for (const image of data) {
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

  const stepRows = await selectInBatches<RecipeStepRow>(recipeIds, (batch) =>
    supabase.from('recipe_steps').select('id, recipe_id').in('recipe_id', batch)
  )
  const stepToRecipeId = new Map(stepRows.map((step) => [step.id, step.recipe_id]))
  const statsByRecipeId = new Map<string, { cards: number; paintIds: Set<string> }>()

  // Starts at 0, not 1 - this feeds the library listing's "X cards" count
  // (GuidesV3Deck.cards below), which should reflect real content cards
  // only. The cover isn't a recipe_steps row, so it was never counted here
  // to begin with; the +1 this used to start at just overcounted every
  // deck by one (most visibly a 1-step deck showing "2 cards"). The deck
  // detail page's own on-card "X Cards" stat is a separate, deliberately
  // cover-inclusive computation (steps.length + hasCover) in
  // guides-v3-detail-data.ts and page.tsx - unaffected by this.
  for (const recipeId of recipeIds) {
    statsByRecipeId.set(recipeId, { cards: 0, paintIds: new Set() })
  }

  for (const step of stepRows) {
    const stats = statsByRecipeId.get(step.recipe_id)
    if (stats) stats.cards += 1
  }

  const stepIds = stepRows.map((step) => step.id)
  const stepPaints = await selectInBatches<RecipeStepPaintRow>(stepIds, (batch) =>
    supabase
      .from('recipe_step_paints')
      .select('recipe_step_id, paint_catalog_id, custom_paint_id')
      .in('recipe_step_id', batch)
  )

  for (const link of stepPaints) {
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

  type RecipeIdRow = { recipe_id: string }
  const [likeRows, saveRows, viewerLikeRows, viewerSaveRows] = await Promise.all([
    selectInBatches<RecipeIdRow>(recipeIds, (batch) =>
      supabase.from('recipe_likes').select('recipe_id').in('recipe_id', batch)),
    // RLS hides other users' saved_recipes rows, so totals come from an
    // aggregate-only RPC rather than counting rows client-side.
    selectInBatches<{ recipe_id: string; save_count: number }>(recipeIds, (batch) =>
      supabase.rpc('recipe_save_counts', { recipe_ids: batch })),
    selectInBatches<RecipeIdRow>(recipeIds, (batch) =>
      supabase.from('recipe_likes').select('recipe_id').eq('user_id', userId).in('recipe_id', batch)),
    selectInBatches<RecipeIdRow>(recipeIds, (batch) =>
      supabase.from('saved_recipes').select('recipe_id').eq('user_id', userId).in('recipe_id', batch)),
  ])

  const countsByRecipeId = new Map<string, ReturnType<typeof emptyState>>()
  function ensure(recipeId: string) {
    let entry = countsByRecipeId.get(recipeId)
    if (!entry) {
      entry = emptyState()
      countsByRecipeId.set(recipeId, entry)
    }
    return entry
  }

  for (const row of likeRows) {
    ensure(row.recipe_id).likeCount += 1
  }
  for (const row of saveRows) {
    ensure(row.recipe_id).saveCount = Number(row.save_count) || 0
  }
  for (const row of viewerLikeRows) {
    ensure(row.recipe_id).viewerHasLiked = true
  }
  for (const row of viewerSaveRows) {
    ensure(row.recipe_id).viewerHasSaved = true
  }

  return countsByRecipeId
}

function toDeck({
  imageByRecipeId,
  recipe,
  saved,
  statsByRecipeId,
  socialByRecipeId,
  userId,
}: {
  imageByRecipeId: Map<string, string>
  recipe: RecipeRow
  saved: boolean
  statsByRecipeId: Map<string, { cards: number; paints: number }>
  socialByRecipeId: Map<string, { likeCount: number; saveCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean }>
  userId: string
}): GuidesV3Deck {
  const stats = statsByRecipeId.get(recipe.id)
  const social = socialByRecipeId.get(recipe.id)

  return {
    id: recipe.id,
    title: cleanText(recipe.name, 'Untitled Guide'),
    category: inferCategory(recipe),
    cards: stats?.cards ?? 0,
    paints: stats?.paints ?? 0,
    usedIn: 0,
    image: getGuideDeckThumbnail(
      recipe.image_url || imageByRecipeId.get(recipe.id),
      fallbackImage
    ),
    difficulty: recipe.difficulty ?? null,
    saved,
    isOwner: recipe.user_id === userId,
    accent: accentFor(recipe.id),
    createdAt: recipe.created_at ?? '',
    inlineGuideId: recipe.inline_guide_id ?? null,
    description: cleanText(recipe.description, `${stats?.cards ?? 0} cards · ${stats?.paints ?? 0} paints`),
    likeCount: social?.likeCount ?? 0,
    saveCount: social?.saveCount ?? 0,
    viewerHasLiked: social?.viewerHasLiked ?? false,
    viewerHasSaved: social?.viewerHasSaved ?? false,
  }
}

// Builds a real Guide File from a `guides` row plus all of its member
// decks. `guides.title` is populated at creation time for every guide (the
// auto-guide backfill/trigger set it to the recipe's name; the Forge "guide"
// flow lets the user set their own), so the deck-name fallback below is
// defensive rather than the common path. A guide can wrap one deck (the
// common auto-guide case) or several (a user-composed guide) - `memberDecks`
// carries all of them, in guide_decks.position order, and every aggregate
// below (cards, decks, palette) is computed across the full set. Likes/saves
// stay keyed to a single recipe (the first member), since that's the only
// thing recipe_likes/saved_recipes can reference today.
function toGuideFile(
  guide: GuideRow,
  memberDecks: GuidesV3Deck[],
  primaryRecipe: RecipeRow,
  socialByRecipeId: Map<
    string,
    { likeCount: number; saveCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean }
  >,
  userId: string
): GuidesV3GuideFile {
  const primaryDeck = memberDecks[0]
  // Likes/saves follow the guide's pinned deck, not whichever deck is first.
  const socialDeckId = socialDeckIdOf(guide.primary_recipe_id, memberDecks.map((deck) => deck.id))
  const social = socialByRecipeId.get(socialDeckId)
  const totalCards = memberDecks.reduce((sum, deck) => sum + deck.cards, 0)
  const customDescription = guide.description?.trim()

  return {
    id: guide.id,
    title: cleanText(guide.title, `${primaryDeck.title} Guide`),
    subtitle: customDescription
      ? customDescription
      : formatSubtitle(primaryRecipe, 'A public painting guide.'),
    image: guide.image_url
      ? getGuideDeckThumbnail(guide.image_url, fallbackImage)
      : primaryDeck.image,
    decks: memberDecks.filter((deck) => !deck.inlineGuideId || deck.inlineGuideId !== guide.id).length,
    cards: totalCards,
    level: guideDifficulty(guide.difficulty, totalCards),
    ownedPercent: 0,
    palette: memberDecks.length
      ? memberDecks.slice(0, 5).map((deck) => deck.accent)
      : ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37'],
    deckId: socialDeckId,
    deckIds: memberDecks.map((deck) => deck.id),
    difficulty: guide.difficulty ?? null,
    tags: Array.isArray(guide.tags) ? guide.tags : [],
    isOwner: guide.user_id === userId,
    likeCount: social?.likeCount ?? 0,
    saveCount: social?.saveCount ?? 0,
    viewerHasLiked: social?.viewerHasLiked ?? false,
    viewerHasSaved: social?.viewerHasSaved ?? false,
    createdAt: guide.created_at ?? '',
    visibility: guideVisibilityOf(guide.visibility),
  }
}

export const getGuidesV3Payload = cache(async (
  userId: string,
  tab: GuidesV3Tab | 'all' = 'all'
) => {
  const supabase = await createClient()

  const [myRecipesResult, savedRowsResult, publicGuidesResult, myGuidesResult] =
    await Promise.all([
      tab === 'decks' || tab === 'all'
        ? loadAllPages<RecipeRow>((from, to) => selectDifficultyCompatible('id, name, description, image_url, is_public, difficulty, inline_guide_id, created_at, user_id', selection => supabase
          .from('recipes')
          .select(selection)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to).returns<RecipeRow[]>()))
        : Promise.resolve({ data: [] as RecipeRow[], error: null }),
      loadAllPages<SavedRecipeRow>((from, to) => supabase
        .from('saved_recipes')
        .select('recipe_id')
        .eq('user_id', userId)
        .order('recipe_id', { ascending: true })
        .range(from, to)
        .returns<SavedRecipeRow[]>()),
      // Public library: RLS on `guides` already restricts selects to "own
      // or has a public member deck", so this is effectively "every guide
      // with at least one public deck, plus my own (possibly private)
      // guides" - the isGuidePublic() filter below removes the latter.
      tab === 'library' || tab === 'all'
        ? loadAllVisibleGuideRows(supabase)
        : Promise.resolve({ data: [] as GuideRow[], error: null }),
      // My Guides: guides I own (draft/private/public alike, per RLS's
      // "own" clause).
      tab === 'guides' || tab === 'all'
        ? loadAllPages<GuideRow>((from, to) => selectDifficultyCompatible(guideWithDecksSelect, selection => supabase
          .from('guides')
          .select(selection)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to).returns<GuideRow[]>()))
        : Promise.resolve({ data: [] as GuideRow[], error: null }),
    ])

  if (myRecipesResult.error) throw new Error(myRecipesResult.error.message)
  if (savedRowsResult.error) throw new Error(savedRowsResult.error.message)
  if (publicGuidesResult.error) throw new Error(publicGuidesResult.error.message)
  if (myGuidesResult.error) throw new Error(myGuidesResult.error.message)

  const myRecipes = (myRecipesResult.data ?? []) as RecipeRow[]
  const savedRows = (savedRowsResult.data ?? []) as SavedRecipeRow[]
  const savedRecipeIds = new Set(savedRows.map((row) => row.recipe_id))
  const ownedRecipeIds = new Set(myRecipes.map((recipe) => recipe.id))

  // Building blocks never list on their own (see shared/guide-listing).
  const listedGuides = withoutRedundantAutoGuides(
    ((publicGuidesResult.data ?? []) as GuideRow[]).filter(isGuidePublic)
  )
  const publicGuides = withoutNestedAutoGuides(listedGuides, await composedGuideIdsByDeck(listedGuides))
  const ownedGuides = ((myGuidesResult.data ?? []) as GuideRow[]).filter(
    (guide) => guide.user_id === userId
  )

  // Saved guides: other creators' public guides the viewer bookmarked. A
  // guide's bookmark saves its primary deck, so a guide counts as saved only
  // when that primary deck is saved - otherwise saving one deck would also
  // list every other guide that happens to contain it. The aliased
  // `saved_match` inner join filters the guides while leaving the full
  // `guide_decks` embed intact (filtering `guide_decks` directly would trim
  // a multi-deck guide down to just its saved decks).
  const savedRecipeIdList = Array.from(savedRecipeIds)
  // Batched so a long saved list never overflows the request URL; a guide
  // matched by more than one batch is kept once, newest first.
  const savedGuideRows =
    (tab === 'guides' || tab === 'all') && savedRecipeIdList.length > 0
      ? await selectInBatches<GuideRow>(savedRecipeIdList, (batch) => selectDifficultyCompatible(
          `${guideWithDecksSelect.trim()}, saved_match:guide_decks!inner(recipe_id)`,
          selection => supabase
            .from('guides')
            .select(selection)
            .neq('user_id', userId)
            .in('saved_match.recipe_id', batch)
            .returns<GuideRow[]>()))
      : []
  const savedGuidesResult = {
    data: Array.from(new Map(savedGuideRows.map((guide) => [guide.id, guide])).values())
      .sort((first, second) => (second.created_at ?? '').localeCompare(first.created_at ?? '')),
  }

  // An owned auto-guide with a card layout was customized, so it is not a
  // plain mirror of its deck. If layouts can't be read, treat every auto-guide
  // as customized: listing both is safer than hiding one.
  const ownedAutoGuideIds = ownedGuides.filter((guide) => guide.is_auto).map((guide) => guide.id)
  const customizedLayoutGuideIds = new Set<string>()
  if (ownedAutoGuideIds.length) {
    try {
      const layoutRows = await selectInBatches<{ id: string; card_layout: unknown }>(ownedAutoGuideIds, (batch) =>
        supabase.from('guides').select('id, card_layout').in('id', batch))
      for (const row of layoutRows) {
        if (!Array.isArray(row.card_layout) || row.card_layout.length > 0) customizedLayoutGuideIds.add(row.id)
      }
    } catch {
      for (const id of ownedAutoGuideIds) customizedLayoutGuideIds.add(id)
    }
  }
  function mirroredDeckId(guide: GuideRow, recipes: RecipeRow[]) {
    if (guide.user_id !== userId || !guide.is_auto || recipes.length !== 1) return undefined
    if (guide.description?.trim() || guide.image_url || customizedLayoutGuideIds.has(guide.id)) return undefined
    return ownedRecipeIds.has(recipes[0].id) ? recipes[0].id : undefined
  }

  // A saved deck can only ever be one the user could already see when they
  // saved it (public per `recipes`' own RLS) - re-assert that here rather
  // than trusting it blindly. A saved guide stays saved after its owner
  // pulls it back to private or draft.
  const savedGuides = ((savedGuidesResult.data ?? []) as GuideRow[]).filter(
    (guide) => {
      if (!hasPublicContent(guide)) return false
      const primary = primaryRecipeOf(guide, memberRecipesOf(guide))
      return primary ? savedRecipeIds.has(primary.id) : false
    }
  )

  const ownedGuideIds = new Set(ownedGuides.map((guide) => guide.id))
  const myGuides = withoutRedundantAutoGuides([
    ...ownedGuides,
    ...savedGuides.filter((guide) => !ownedGuideIds.has(guide.id)),
  ])

  // Decks are only the viewer's own creations. Saving someone else's public
  // deck saves it as a guide (every public deck has an auto guide), so it
  // surfaces through savedGuides in the Guides tab, never here.
  // A guide's own-cards deck is part of that guide, never a deck of its own
  // in the list; it stays reusable inside other guides (nestableDecks).
  const ownedRecipes = myRecipes
  const deckRecipes = ownedRecipes.filter((recipe) => !recipe.inline_guide_id)

  const publicRecipesByGuideId = new Map<string, RecipeRow[]>()
  for (const guide of publicGuides) {
    const recipes = memberRecipesOf(guide)
    if (recipes.length) publicRecipesByGuideId.set(guide.id, recipes)
  }

  const myGuideRecipesByGuideId = new Map<string, RecipeRow[]>()
  for (const guide of myGuides) {
    const recipes = memberRecipesOf(guide)
    if (recipes.length) myGuideRecipesByGuideId.set(guide.id, recipes)
  }

  const allRecipesForStats = Array.from(
    new Map(
      [
        ...ownedRecipes,
        ...Array.from(publicRecipesByGuideId.values()).flat(),
        ...Array.from(myGuideRecipesByGuideId.values()).flat(),
      ].map((recipe) => [recipe.id, recipe])
    ).values()
  )

  const allRecipeIdsForStats = allRecipesForStats.map((recipe) => recipe.id)
  const [statsByRecipeId, imageByRecipeId, socialByRecipeId, creatorsById] = await Promise.all([
    loadRecipeStats(supabase, allRecipeIdsForStats),
    loadRecipeImages(supabase, allRecipesForStats),
    loadRecipeSocialCounts(supabase, allRecipeIdsForStats, userId),
    loadGuideCreators([
      ...publicGuides.map((guide) => guide.user_id),
      ...myGuides.filter((guide) => guide.user_id !== userId).map((guide) => guide.user_id),
    ]),
  ])

  const decks = deckRecipes.map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: true,
      statsByRecipeId,
      socialByRecipeId,
      userId,
    })
  )

  const ownedGuideTitleById = new Map(ownedGuides.map((guide) => [guide.id, cleanText(guide.title, 'Untitled Guide')]))
  const nestableDecks = ownedRecipes.map((recipe) => {
    const deck = toDeck({ imageByRecipeId, recipe, saved: true, statsByRecipeId, socialByRecipeId, userId })
    return recipe.inline_guide_id ? { ...deck, title: ownedGuideTitleById.get(recipe.inline_guide_id) ?? deck.title } : deck
  })

  const libraryRecipeById = new Map(
    Array.from(publicRecipesByGuideId.values())
      .flat()
      .map((recipe) => [recipe.id, recipe])
  )
  const libraryDecks = Array.from(libraryRecipeById.values()).map((recipe) =>
    toDeck({
      imageByRecipeId,
      recipe,
      saved: savedRecipeIds.has(recipe.id) || ownedRecipeIds.has(recipe.id),
      statsByRecipeId,
      socialByRecipeId,
      userId,
    })
  )
  const libraryDeckById = new Map(libraryDecks.map((deck) => [deck.id, deck]))

  const libraryGuides = publicGuides
    .map((guide): GuidesV3GuideFile | null => {
      const recipes = publicRecipesByGuideId.get(guide.id)
      if (!recipes?.length) return null
      const memberDecks = recipes
        .map((recipe) => libraryDeckById.get(recipe.id))
        .filter((deck): deck is GuidesV3Deck => Boolean(deck))
      if (!memberDecks.length) return null
      const primaryRecipe = recipes.find((recipe) => recipe.is_public) ?? recipes[0]
      return {
        ...toGuideFile(guide, memberDecks, primaryRecipe, socialByRecipeId, userId),
        creator: creatorsById.get(guide.user_id),
      }
    })
    .filter((guide): guide is GuidesV3GuideFile => Boolean(guide))

  const guideFiles = myGuides
    .map((guide): GuidesV3GuideFile | null => {
      const recipes = myGuideRecipesByGuideId.get(guide.id)
      if (!recipes?.length) return null
      const memberDecks = recipes.map((recipe) =>
        toDeck({
          imageByRecipeId,
          recipe,
          saved: true,
          statsByRecipeId,
          socialByRecipeId,
          userId,
        })
      )
      const primaryRecipe = recipes.find((recipe) => recipe.is_public) ?? recipes[0]
      return {
        ...toGuideFile(guide, memberDecks, primaryRecipe, socialByRecipeId, userId),
        // Saved guides from other creators show who made them.
        creator: guide.user_id === userId ? undefined : creatorsById.get(guide.user_id),
        mirrorsDeckId: mirroredDeckId(guide, recipes),
      }
    })
    .filter((guide): guide is GuidesV3GuideFile => Boolean(guide))

  return {
    guideFiles,
    decks,
    nestableDecks,
    libraryGuides,
    libraryDecks,
    savedDeckIds: Array.from(
      new Set([...savedRecipeIds, ...ownedRecipeIds])
    ),
  } satisfies GuidesV3Payload
})

// Guides by id, for the viewer's own and readable ones (RLS: own, or with a
// public deck) whether or not they are listed - e.g. a guide the viewer
// assigned to a unit or project before its owner pulled it back to private.
// Returns their member decks too, for callers that resolve deck lists.
export async function getGuideFilesByIds(userId: string, guideIds: string[]) {
  const ids = Array.from(new Set(guideIds.filter(Boolean)))
  if (!ids.length) return { guides: [] as GuidesV3GuideFile[], decks: [] as GuidesV3Deck[] }
  const supabase = await createClient()
  const rows = await selectInBatches<GuideRow>(ids, (batch) =>
    supabase.from('guides').select(guideWithDecksSelect).in('id', batch).returns<GuideRow[]>())
  const readable = rows.filter((guide) => guide.user_id === userId || hasPublicContent(guide))
  const recipes = Array.from(new Map(readable.flatMap(memberRecipesOf).map((recipe) => [recipe.id, recipe])).values())
  const recipeIds = recipes.map((recipe) => recipe.id)
  const [statsByRecipeId, imageByRecipeId, socialByRecipeId, creatorsById] = await Promise.all([
    loadRecipeStats(supabase, recipeIds),
    loadRecipeImages(supabase, recipes),
    loadRecipeSocialCounts(supabase, recipeIds, userId),
    loadGuideCreators(readable.filter((guide) => guide.user_id !== userId).map((guide) => guide.user_id)),
  ])
  const deckById = new Map(recipes.map((recipe) => [recipe.id, toDeck({
    recipe, imageByRecipeId, statsByRecipeId, socialByRecipeId, userId,
    saved: socialByRecipeId.get(recipe.id)?.viewerHasSaved ?? recipe.user_id === userId,
  })]))
  const guides = readable.flatMap((guide) => {
    const memberRecipes = memberRecipesOf(guide)
    const memberDecks = memberRecipes.map((recipe) => deckById.get(recipe.id)).filter((deck): deck is GuidesV3Deck => Boolean(deck))
    if (!memberDecks.length) return []
    const primaryRecipe = memberRecipes.find((recipe) => recipe.is_public) ?? memberRecipes[0]
    return [{
      ...toGuideFile(guide, memberDecks, primaryRecipe, socialByRecipeId, userId),
      creator: guide.user_id === userId ? undefined : creatorsById.get(guide.user_id),
    }]
  })
  return { guides, decks: Array.from(deckById.values()) }
}

// Load the creator's entire public collection, independently of Discover's
// global limit. Keep the same thumbnail, guide mapping and social state.
// `shared` reads for a logged-out or non-member visitor (the public contest
// creator page): it bypasses RLS, so only public guides and public decks are kept.
export async function getCreatorPublicGuides(creatorId: string, viewerId: string, { shared = false } = {}) {
  const supabase = shared ? createSharedReadClient() : await createClient()
  const result: GuidesV3GuideFile[] = []
  const listedGuides: GuideRow[] = []
  const pageSize = 100

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('guides')
      .select(guideWithDecksSelect)
      .eq('user_id', creatorId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as GuideRow[]
    const publicGuides = rows.filter(isGuidePublic)
    listedGuides.push(...publicGuides)
    const recipesByGuideId = new Map<string, RecipeRow[]>()
    for (const guide of publicGuides) {
      const recipes = memberRecipesOf(guide).filter((recipe) => !shared || recipe.is_public)
      if (recipes.length) recipesByGuideId.set(guide.id, recipes)
    }
    const recipes = Array.from(
      new Map(Array.from(recipesByGuideId.values()).flat().map((recipe) => [recipe.id, recipe])).values()
    )
    const recipeIds = recipes.map((recipe) => recipe.id)
    const [statsByRecipeId, imageByRecipeId, socialByRecipeId] = await Promise.all([
      loadRecipeStats(supabase, recipeIds),
      loadRecipeImages(supabase, recipes),
      // Visitors get no like/save actions, so skip the viewer's social state.
      shared ? Promise.resolve(new Map<string, never>()) : loadRecipeSocialCounts(supabase, recipeIds, viewerId),
    ])
    for (const guide of publicGuides) {
      const memberRecipes = recipesByGuideId.get(guide.id)
      if (!memberRecipes?.length) continue
      const memberDecks = memberRecipes.map((recipe) =>
        toDeck({
          recipe, imageByRecipeId, statsByRecipeId,
          socialByRecipeId,
          userId: viewerId,
          saved: socialByRecipeId.get(recipe.id)?.viewerHasSaved ?? false,
        })
      )
      const primaryRecipe = memberRecipes.find((recipe) => recipe.is_public) ?? memberRecipes[0]
      result.push(toGuideFile(guide, memberDecks, primaryRecipe, socialByRecipeId, viewerId))
    }
    if (rows.length < pageSize) {
      const keptIds = new Set(creatorCollectionGuides(listedGuides).map((guide) => guide.id))
      return result.filter((guide) => keptIds.has(guide.id))
    }
  }
}

// The creator's collection rule (see shared/creator-collection.ts), judged
// on public decks only so the owner - who can also see their private decks
// - gets the same list as everyone else. Unlike Discover, multi-deck guides
// are listed in addition to their decks.
function creatorCollectionGuides(guides: GuideRow[]) {
  const kept = new Set(
    selectCreatorCollection(
      guides.map((guide) => ({
        id: guide.id,
        isAuto: Boolean(guide.is_auto),
        publicDeckIds: memberRecipesOf(guide).filter((deck) => deck.is_public && !isInlineDeckOf(guide, deck)).map((deck) => deck.id),
        hasPublicInline: memberRecipesOf(guide).some((deck) => deck.is_public && isInlineDeckOf(guide, deck)),
      }))
    ).map((guide) => guide.id)
  )
  return guides.filter((guide) => kept.has(guide.id))
}

// One public or unlisted guide for the share route (/s/guides/[id]). Reads
// bypass RLS (see createSharedReadClient), so the explicit visibility and
// is_public member filters below are the only thing keeping private guides
// and decks out. No viewer social state - visitors can't like or save.
export const getSharedGuideFile = cache(async (guideId: string) => {
  const supabase = createSharedReadClient()
  const { data, error } = await selectDifficultyCompatible(guideWithDecksSelect, selection => supabase
    .from('guides')
    .select(selection)
    .eq('id', guideId)
    .maybeSingle()
    .returns<GuideRow | null>())

  // An invalid uuid surfaces as 22P02; treat it like a missing guide.
  if (error && error.code !== '22P02') throw new Error(error.message)
  const guide = data as GuideRow | null
  if (!guide || !allowsGuideShareLink(guide.visibility)) return null

  const memberRecipes = [...(guide.guide_decks ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((guideDeck) => firstValue(guideDeck.recipes))
    .filter((recipe): recipe is RecipeRow => recipe?.is_public === true)
  if (!memberRecipes.length) return null

  const recipeIds = memberRecipes.map((recipe) => recipe.id)
  const [statsByRecipeId, imageByRecipeId] = await Promise.all([
    loadRecipeStats(supabase, recipeIds),
    loadRecipeImages(supabase, memberRecipes),
  ])
  const socialByRecipeId = new Map<string, { likeCount: number; saveCount: number; viewerHasLiked: boolean; viewerHasSaved: boolean }>()
  const memberDecks = memberRecipes.map((recipe) =>
    toDeck({ recipe, imageByRecipeId, statsByRecipeId, socialByRecipeId, userId: '', saved: false })
  )

  return {
    guide: toGuideFile(guide, memberDecks, memberRecipes[0], socialByRecipeId, ''),
    decks: memberDecks,
    coverImageUrl: guide.image_url || memberRecipes[0].image_url || imageByRecipeId.get(memberRecipes[0].id) || null,
  }
})
