'use server'

import { parseGuideCardLayout, type GuideCardPlacement } from './shared/guide-card-layout'
import { normalizeGuideTags } from './shared/guide-tags'
import { visibilityFromStatus } from './shared/guide-visibility'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'
import { updatePaintOwnership } from '../../utils/paint-ownership/update-paint-ownership'
import { getGuideDeckThumbnail } from './guides-v3-data'
import { syncRecipeSteps, updateStep } from './sync-recipe-steps'
import { cardTypeDefaultBody, cardTypeLabel, isCardTypeId } from './shared/card-templates'
import {
  cleanText,
  deckCardPaintRows,
  deckCardStepFields,
  encodeDeckCardInstructions,
  safeCardTemplate,
  safeFocalValue,
  safePersistedImage,
  safeThemeSubtitle,
  type CreateDeckCardInput,
} from './deck-card-rows'

export type { CreateDeckCardInput } from './deck-card-rows'

export type CreateDeckInput = {
  title: string
  description: string
  status: string
  difficulty?: string
  image: string | null
  heroFocalX?: number
  heroFocalY?: number
  inventoryRequired?: string | null
  expertTips?: string | null
  cards: CreateDeckCardInput[]
}

export type CreatedDeckResult = {
  id: string
  title: string
  category: string
  cards: number
  paints: number
  usedIn: number
  image: string
  difficulty: string | null
  saved: boolean
  isOwner: boolean
  accent: string
  createdAt: string
}

type SupabaseErrorLike = {
  code?: string
  message?: string
}

type RecipeStepInsert = {
  recipe_id: string
  user_id: string
  step_number: number
  title: string
  card_template?: string | null
  instructions: string
  image_url: string | null
  youtube_url: string | null
  image_focal_x: number
  image_focal_y: number
  subtitle?: string | null
}

function accentFor(seed: string) {
  const colors = ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#1e4f92']
  const index =
    seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    colors.length

  return colors[index] ?? colors[0]
}

function categoryFor(input: CreateDeckInput) {
  if (
    input.cards.some((card) =>
      card.template === 'image' || card.template === 'small-image'
    )
  ) {
    return 'Image + Steps'
  }
  if (input.cards.some((card) => card.template === 'paints')) return 'Paints'
  return 'Steps'
}

function isMissingColumn(error: SupabaseErrorLike | null | undefined, column: string) {
  const message = error?.message ?? ''

  return (
    error?.code === '42703' ||
    (message.includes(column) &&
      (message.includes('does not exist') || message.includes('schema cache')))
  )
}

function withoutCardTemplate(steps: RecipeStepInsert[]) {
  return steps.map((step) => ({
    recipe_id: step.recipe_id,
    user_id: step.user_id,
    step_number: step.step_number,
    title: step.title,
    instructions: step.instructions,
    image_url: step.image_url,
    youtube_url: step.youtube_url,
    image_focal_x: step.image_focal_x,
    image_focal_y: step.image_focal_y,
  }))
}

function withoutYoutubeUrl(steps: RecipeStepInsert[]) {
  return steps.map((step) => ({
    recipe_id: step.recipe_id,
    user_id: step.user_id,
    step_number: step.step_number,
    title: step.title,
    card_template: step.card_template,
    instructions: step.instructions,
    image_url:
      step.card_template === 'video'
        ? step.youtube_url ?? step.image_url
        : step.image_url,
    image_focal_x: step.image_focal_x,
    image_focal_y: step.image_focal_y,
  }))
}

function withoutCardTemplateAndYoutubeUrl(steps: RecipeStepInsert[]) {
  return steps.map((step) => ({
    recipe_id: step.recipe_id,
    user_id: step.user_id,
    step_number: step.step_number,
    title: step.title,
    instructions: step.instructions,
    image_url:
      step.card_template === 'video'
        ? step.youtube_url ?? step.image_url
        : step.image_url,
    image_focal_x: step.image_focal_x,
    image_focal_y: step.image_focal_y,
  }))
}

async function insertRecipeSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  steps: RecipeStepInsert[]
) {
  let result = await supabase
    .from('recipe_steps')
    .insert(steps)
    .select('id, step_number')

  if (isMissingColumn(result.error, 'youtube_url')) {
    result = await supabase
      .from('recipe_steps')
      .insert(withoutYoutubeUrl(steps))
      .select('id, step_number')
  }

  if (isMissingColumn(result.error, 'card_template')) {
    result = await supabase
      .from('recipe_steps')
      .insert(withoutCardTemplate(steps))
      .select('id, step_number')
  }

  if (
    isMissingColumn(result.error, 'youtube_url') ||
    isMissingColumn(result.error, 'card_template')
  ) {
    result = await supabase
      .from('recipe_steps')
      .insert(withoutCardTemplateAndYoutubeUrl(steps))
      .select('id, step_number')
  }

  return result
}

export async function createDeckFromForge(
  input: CreateDeckInput
): Promise<CreatedDeckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const title = cleanText(input.title, 'New Deck')
  const description = cleanText(input.description, 'A custom painting deck.')
  const coverIndex = input.cards.findIndex((card) =>
    card.template === 'title' || card.template === 'cover'
  )
  const coverCard = coverIndex === -1 ? undefined : input.cards[coverIndex]
  // Where the synthesized cover card belongs in the full cover+steps
  // sequence, or null to omit it - wherever the 'cover' template card
  // happens to sit in the editor's card list at save time.
  const coverPosition = coverIndex === -1 ? null : coverIndex
  const coverImage = safePersistedImage(input.image ?? coverCard?.image)
  const coverFocalX = safeFocalValue(input.heroFocalX ?? coverCard?.imageFocalX)
  const coverFocalY = safeFocalValue(input.heroFocalY ?? coverCard?.imageFocalY)
  const isPublic = input.status === 'Public'
  const difficulty = input.difficulty || null

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name: title,
      description,
      image_url: coverImage,
      is_public: isPublic,
      difficulty,
      cover_position: coverPosition,
      cover_focal_x: coverFocalX,
      cover_focal_y: coverFocalY,
    })
    .select('id, name, image_url, created_at')
    .single()

  if (recipeError || !recipe) {
    throw new Error(recipeError?.message || 'Could not create deck')
  }

  const stepCards = input.cards.filter((card) =>
    card.template !== 'title' && card.template !== 'cover'
  )
  const steps: RecipeStepInsert[] = stepCards.map((card, index) => ({
    recipe_id: recipe.id,
    user_id: user.id,
    step_number: index + 1,
    ...deckCardStepFields(card, index),
  }))

  let insertedSteps: Array<{ id: string; step_number: number }> = []

  if (steps.length) {
    const { data: stepRows, error: stepsError } = await insertRecipeSteps(
      supabase,
      steps
    )

    if (stepsError) throw new Error(stepsError.message)
    insertedSteps = stepRows ?? []
  }

  const stepPaintsToInsert = stepCards.flatMap((card, cardIndex) => {
    const step = insertedSteps.find((row) => row.step_number === cardIndex + 1)
    if (!step) return []

    return deckCardPaintRows(step.id, user.id, card.paints)
  })

  if (stepPaintsToInsert.length) {
    const { error: stepPaintsError } = await supabase
      .from('recipe_step_paints')
      .insert(stepPaintsToInsert)

    if (stepPaintsError) throw new Error(stepPaintsError.message)
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'deck_created',
    properties: {
      deck_id: recipe.id,
      card_count: stepCards.length,
      is_public: isPublic,
      category: categoryFor(input),
    },
  })

  revalidatePath('/guides')
  revalidatePath('/recipes')

  return {
    id: recipe.id,
    title: cleanText(recipe.name, title),
    category: categoryFor(input),
    cards: stepCards.length + 1,
    paints: new Set(stepPaintsToInsert.map((paint) =>
      paint.paint_catalog_id
        ? `catalog:${paint.paint_catalog_id}`
        : `custom:${paint.custom_paint_id}`
    )).size,
    usedIn: 0,
    image: getGuideDeckThumbnail(recipe.image_url, '/onboarding/pains/tough-choices.jpeg'),
    difficulty,
    saved: true,
    isOwner: true,
    accent: accentFor(recipe.id),
    createdAt: recipe.created_at ?? '',
  }
}

export async function updateDeckFromForge(
  deckId: string,
  input: CreateDeckInput
): Promise<CreatedDeckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!deckId) throw new Error('Missing deck id')

  const title = cleanText(input.title, 'New Deck')
  const description = cleanText(input.description, 'A custom painting deck.')
  const coverIndex = input.cards.findIndex((card) =>
    card.template === 'title' || card.template === 'cover'
  )
  const coverCard = coverIndex === -1 ? undefined : input.cards[coverIndex]
  const coverPosition = coverIndex === -1 ? null : coverIndex
  const coverImage = safePersistedImage(input.image ?? coverCard?.image)
  const coverFocalX = safeFocalValue(input.heroFocalX ?? coverCard?.imageFocalX)
  const coverFocalY = safeFocalValue(input.heroFocalY ?? coverCard?.imageFocalY)
  const isPublic = input.status === 'Public'
  const difficulty = input.difficulty || null

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .update({
      name: title,
      description,
      image_url: coverImage,
      is_public: isPublic,
      difficulty,
      cover_position: coverPosition,
      cover_focal_x: coverFocalX,
      cover_focal_y: coverFocalY,
      inventory_required: input.inventoryRequired?.trim() || null,
      expert_tips: input.expertTips?.trim() || null,
    })
    .eq('id', deckId)
    .eq('user_id', user.id)
    .select('id, name, image_url, created_at')
    .single()

  if (recipeError || !recipe) {
    throw new Error(recipeError?.message || 'Could not save deck')
  }

  const stepCards = input.cards.filter((card) =>
    card.template !== 'title' && card.template !== 'cover'
  )
  const steps: RecipeStepInsert[] = stepCards.map((card, index) => ({
    recipe_id: deckId,
    user_id: user.id,
    step_number: index + 1,
    ...deckCardStepFields(card, index),
  }))

  const { data: existingSteps, error: existingStepsError } = await supabase
    .from('recipe_steps')
    .select('id')
    .eq('recipe_id', deckId)

  if (existingStepsError) throw new Error(existingStepsError.message)

  const existingStepIds = (existingSteps ?? []).map((step) => step.id)

  // Keep step ids stable: guides reference cards by id (guides.card_layout),
  // so reinserting every step would reset each guide's hidden cards and order.
  const sync = await syncRecipeSteps(supabase, {
    deckId,
    existingIds: existingStepIds,
    cardIds: stepCards.map((card) => card.id),
    rows: steps,
    insertSteps: (rows) => insertRecipeSteps(supabase, rows),
  })

  let stepIdByIndex: Array<string | undefined> = []

  if (sync.status === 'synced') {
    stepIdByIndex = sync.stepIds
    const keptStepIds = sync.stepIds.filter((id) => existingStepIds.includes(id))
    if (keptStepIds.length) {
      const { error: deleteStepPaintsError } = await supabase
        .from('recipe_step_paints')
        .delete()
        .in('recipe_step_id', keptStepIds)

      if (deleteStepPaintsError) throw new Error(deleteStepPaintsError.message)
    }
  } else {
    // Legacy save, for a database that accepts no recipe_steps updates.
    if (existingStepIds.length) {
      const { error: deleteStepPaintsError } = await supabase
        .from('recipe_step_paints')
        .delete()
        .in('recipe_step_id', existingStepIds)

      if (deleteStepPaintsError) throw new Error(deleteStepPaintsError.message)

      const { error: deleteStepsError } = await supabase
        .from('recipe_steps')
        .delete()
        .eq('recipe_id', deckId)

      if (deleteStepsError) throw new Error(deleteStepsError.message)
    }

    if (steps.length) {
      const { data: stepRows, error: stepsError } = await insertRecipeSteps(
        supabase,
        steps
      )

      if (stepsError) throw new Error(stepsError.message)
      stepIdByIndex = steps.map((step) =>
        stepRows?.find((row) => row.step_number === step.step_number)?.id
      )
    }
  }

  const stepPaintsToInsert = stepCards.flatMap((card, cardIndex) => {
    const stepId = stepIdByIndex[cardIndex]
    if (!stepId) return []

    return deckCardPaintRows(stepId, user.id, card.paints)
  })

  if (stepPaintsToInsert.length) {
    const { error: stepPaintsError } = await supabase
      .from('recipe_step_paints')
      .insert(stepPaintsToInsert)

    if (stepPaintsError) throw new Error(stepPaintsError.message)
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'deck_updated',
    properties: {
      deck_id: recipe.id,
      card_count: stepCards.length,
      is_public: isPublic,
      category: categoryFor(input),
    },
  })

  revalidatePath(`/guides/decks/${deckId}`)
  revalidatePath('/guides')
  revalidatePath('/recipes')
  revalidatePath(`/recipes/${deckId}`)

  return {
    id: recipe.id,
    title: cleanText(recipe.name, title),
    category: categoryFor(input),
    cards: stepCards.length + 1,
    paints: new Set(stepPaintsToInsert.map((paint) =>
      paint.paint_catalog_id
        ? `catalog:${paint.paint_catalog_id}`
        : `custom:${paint.custom_paint_id}`
    )).size,
    usedIn: 0,
    image: getGuideDeckThumbnail(recipe.image_url, '/onboarding/pains/tough-choices.jpeg'),
    difficulty,
    saved: true,
    isOwner: true,
    accent: accentFor(recipe.id),
    createdAt: recipe.created_at ?? '',
  }
}

export async function deleteDeck(deckId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!deckId) throw new Error('Missing deck id')

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (recipeError) throw new Error(recipeError.message)
  if (!recipe) throw new Error('Deck not found')

  const [{ data: steps, error: stepsError }, { data: guideLinks, error: guideLinksError }] =
    await Promise.all([
      supabase
        .from('recipe_steps')
        .select('id')
        .eq('recipe_id', deckId)
        .eq('user_id', user.id),
      supabase
        .from('guide_decks')
        .select('guide_id')
        .eq('recipe_id', deckId)
        .eq('user_id', user.id),
    ])

  if (stepsError) throw new Error(stepsError.message)
  if (guideLinksError) throw new Error(guideLinksError.message)

  const stepIds = steps?.map((step) => step.id) ?? []

  if (stepIds.length > 0) {
    const { error: stepPaintsError } = await supabase
      .from('recipe_step_paints')
      .delete()
      .in('recipe_step_id', stepIds)
      .eq('user_id', user.id)

    if (stepPaintsError) throw new Error(stepPaintsError.message)
  }

  const { error: stageRecipesError } = await supabase
    .from('unit_stage_recipes')
    .delete()
    .eq('recipe_id', deckId)

  if (stageRecipesError) throw new Error(stageRecipesError.message)

  const { error: savedRecipesError } = await supabase
    .from('saved_recipes')
    .delete()
    .eq('recipe_id', deckId)

  if (savedRecipesError) throw new Error(savedRecipesError.message)

  const { error: imageAssetsError } = await supabase
    .from('image_assets')
    .delete()
    .eq('entity_type', 'recipe')
    .eq('entity_id', deckId)
    .eq('user_id', user.id)

  if (imageAssetsError) throw new Error(imageAssetsError.message)

  const { error: recipeStepsError } = await supabase
    .from('recipe_steps')
    .delete()
    .eq('recipe_id', deckId)
    .eq('user_id', user.id)

  if (recipeStepsError) throw new Error(recipeStepsError.message)

  // guide_decks rows cascade with the recipe.
  const { error: deleteRecipeError } = await supabase
    .from('recipes')
    .delete()
    .eq('id', deckId)
    .eq('user_id', user.id)

  if (deleteRecipeError) throw new Error(deleteRecipeError.message)

  // Guides that only contained this deck would otherwise linger empty.
  const guideIds = Array.from(new Set(guideLinks?.map((link) => link.guide_id) ?? []))

  if (guideIds.length > 0) {
    const { data: remainingLinks, error: remainingLinksError } = await supabase
      .from('guide_decks')
      .select('guide_id')
      .in('guide_id', guideIds)

    if (remainingLinksError) throw new Error(remainingLinksError.message)

    const stillUsed = new Set(remainingLinks?.map((link) => link.guide_id) ?? [])
    const emptyGuideIds = guideIds.filter((guideId) => !stillUsed.has(guideId))

    if (emptyGuideIds.length > 0) {
      const { error: deleteGuidesError } = await supabase
        .from('guides')
        .delete()
        .in('id', emptyGuideIds)
        .eq('user_id', user.id)

      if (deleteGuidesError) throw new Error(deleteGuidesError.message)
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'deck_deleted',
    properties: {
      deck_id: deckId,
      card_count: stepIds.length,
    },
  })

  revalidatePath('/guides')
  revalidatePath('/recipes')
  revalidatePath('/dashboard')
}

// Deletes a guide and its own cards. Guides reused inside it are their own
// guides and stay. If another guide reuses this guide's own cards, those
// cards stay too (they are only released from this guide), so deleting here
// never empties someone else's guide.
export async function deleteGuide(guideId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!guideId) throw new Error('Missing guide id')

  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .select('id')
    .eq('id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (guideError) throw new Error(guideError.message)
  if (!guide) throw new Error('Guide not found')

  const { data: ownCards, error: ownCardsError } = await supabase
    .from('recipes')
    .select('id')
    .eq('inline_guide_id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (ownCardsError) throw new Error(ownCardsError.message)

  let deletedOwnCards = false
  if (ownCards) {
    const { data: otherUses, error: otherUsesError } = await supabase
      .from('guide_decks')
      .select('guide_id')
      .eq('recipe_id', ownCards.id)
      .neq('guide_id', guideId)
      .limit(1)

    if (otherUsesError) throw new Error(otherUsesError.message)

    if (!otherUses?.length) {
      // Also removes this guide once it has no decks left.
      await deleteDeck(ownCards.id)
      deletedOwnCards = true
    }
  }

  // Decks still pointing here (released own cards, or an auto-guide's deck)
  // keep their content; they just stop naming this guide.
  const { error: releaseInlineError } = await supabase
    .from('recipes')
    .update({ inline_guide_id: null })
    .eq('inline_guide_id', guideId)
    .eq('user_id', user.id)

  if (releaseInlineError) throw new Error(releaseInlineError.message)

  const { error: releaseAutoError } = await supabase
    .from('recipes')
    .update({ auto_guide_id: null })
    .eq('auto_guide_id', guideId)
    .eq('user_id', user.id)

  if (releaseAutoError) throw new Error(releaseAutoError.message)

  // guide_decks and content_assignments rows cascade with the guide.
  const { error: deleteGuideError } = await supabase
    .from('guides')
    .delete()
    .eq('id', guideId)
    .eq('user_id', user.id)

  if (deleteGuideError) throw new Error(deleteGuideError.message)

  await captureServerEvent({
    distinctId: user.id,
    event: 'guide_deleted',
    properties: {
      guide_id: guideId,
      deleted_own_cards: deletedOwnCards,
    },
  })

  revalidatePath('/guides')
  revalidatePath('/dashboard')
}

export async function toggleDeckPaintOwnership(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const deckId = formData.get('deckId')?.toString()
  const paintCatalogId = formData.get('paintCatalogId')?.toString()
  const action = formData.get('action')?.toString()
  const currentValue = formData.get('currentValue')?.toString() === 'true'

  if (!deckId || !paintCatalogId) return
  if (action !== 'owned' && action !== 'wishlist') return

  await updatePaintOwnership({
    userId: user.id,
    paintCatalogId,
    action,
    currentValue,
  })

  revalidatePath(`/guides/decks/${deckId}`)
}

export type CreateGuideInput = {
  cardLayout?: GuideCardPlacement[]
  tags?: string[]
  title: string
  description: string
  image: string | null
  deckIds: string[]
  // Draft/Private/Public, saved as guides.visibility (default Draft). Only
  // Public guides are listed. 'Public' also publishes every member deck so
  // viewers can read the cards; 'Draft'/'Private' only unlist the guide and
  // leave decks as they are, so people who saved or assigned it keep it.
  status?: string
  difficulty?: string
}

export type SavedGuideResult = {
  id: string
}

async function verifyOwnedDeckIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  deckIds: string[]
) {
  const { data: ownedRecipes, error } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', userId)
    .in('id', deckIds)

  if (error) throw new Error(error.message)

  if (!ownedRecipes || ownedRecipes.length !== deckIds.length) {
    throw new Error('You can only add your own decks to a guide.')
  }
}

export async function createGuideFromDecks(
  input: CreateGuideInput
): Promise<SavedGuideResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const deckIds = Array.from(new Set(input.deckIds.filter(Boolean)))
  if (deckIds.length === 0) {
    throw new Error('Choose at least one deck for this guide.')
  }

  await verifyOwnedDeckIds(supabase, user.id, deckIds)

  const title = cleanText(input.title, 'New Guide')
  const description = cleanText(
    input.description,
    'A custom guide assembled from decks in your collection.'
  )
  const image = safePersistedImage(input.image)
  const difficulty = input.difficulty || null
  const tags = normalizeGuideTags(input.tags)

  const guideInsert = {
    user_id: user.id,
    title,
    description,
    image_url: image,
    difficulty,
    is_auto: false,
    visibility: visibilityFromStatus(input.status),
    ...(input.tags === undefined ? {} : { tags }),
  }
  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .insert(guideInsert)
    .select('id')
    .single()

  if (guideError || !guide) {
    throw new Error(guideError?.message || 'Could not create guide')
  }

  const { error: guideDecksError } = await supabase.from('guide_decks').insert(
    deckIds.map((recipeId, index) => ({
      guide_id: guide.id,
      recipe_id: recipeId,
      user_id: user.id,
      position: index,
    }))
  )

  if (guideDecksError) throw new Error(guideDecksError.message)

  if (input.status === 'Public') {
    const { error: publishError } = await supabase
      .from('recipes')
      .update({ is_public: true })
      .in('id', deckIds)
      .eq('user_id', user.id)

    if (publishError) throw new Error(publishError.message)
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'guide_created',
    properties: { guide_id: guide.id, deck_count: deckIds.length },
  })

  revalidatePath('/guides')

  return { id: guide.id }
}

export async function updateGuideFromDecks(
  guideId: string,
  input: CreateGuideInput
): Promise<SavedGuideResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')
  if (!guideId) throw new Error('Missing guide id')

  const deckIds = Array.from(new Set(input.deckIds.filter(Boolean)))
  if (deckIds.length === 0) {
    throw new Error('Choose at least one deck for this guide.')
  }

  await verifyOwnedDeckIds(supabase, user.id, deckIds)

  const title = cleanText(input.title, 'New Guide')
  const description = cleanText(
    input.description,
    'A custom guide assembled from decks in your collection.'
  )
  const image = safePersistedImage(input.image)
  const difficulty = input.difficulty || null
  const tags = normalizeGuideTags(input.tags)

  const cardLayout = input.cardLayout === undefined ? null : parseGuideCardLayout(input.cardLayout)
  if (input.cardLayout !== undefined && cardLayout?.length !== input.cardLayout.length) throw new Error('Invalid guide card layout.')
  let { error: guideError } = await supabase.rpc('save_guide_layout', {
    p_guide_id: guideId, p_title: title, p_description: description, p_image: image,
    p_difficulty: difficulty, p_deck_ids: deckIds, p_card_layout: cardLayout, p_tags: tags, p_publish: input.status === 'Public',
    p_visibility: visibilityFromStatus(input.status),
  })
  const missingTaggedSignature = guideError && (
    guideError.code === 'PGRST202' ||
    /save_guide_layout.*p_(tags|visibility)|function public\.save_guide_layout.*does not exist/i.test(guideError.message)
  )
  if (missingTaggedSignature) {
    const fallback = await supabase.rpc('save_guide_layout', {
      p_guide_id: guideId, p_title: title, p_description: description, p_image: image,
      p_difficulty: difficulty, p_deck_ids: deckIds, p_card_layout: cardLayout, p_publish: input.status === 'Public',
    })
    guideError = fallback.error
  }
  if (guideError) throw new Error(guideError.message)

  await captureServerEvent({
    distinctId: user.id,
    event: 'guide_updated',
    properties: { guide_id: guideId, deck_count: deckIds.length },
  })

  revalidatePath('/guides')
  revalidatePath(`/guides/${guideId}`)
  for (const deckId of deckIds) {
    revalidatePath(`/guides/decks/${deckId}`)
  }

  return { id: guideId }
}

// One kind of guide: a deck opened for editing becomes a full guide whose own
// cards are that deck (recipes.inline_guide_id), so it gets every guide
// feature. A public deck's auto-guide becomes that guide - same id, links,
// pinned likes/saves and contest standing; otherwise a guide is created
// around the deck. Guides that already reuse the deck keep showing it as a
// nested guide. Safe to call twice: the first caller wins and a duplicate
// guide is removed.
export async function upgradeDeckToGuide(deckId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!deckId) throw new Error('Missing deck id')

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('id, name, description, is_public, auto_guide_id, inline_guide_id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (recipeError) throw new Error(recipeError.message)
  if (!recipe) throw new Error('Guide not found')
  if (recipe.inline_guide_id) return { guideId: recipe.inline_guide_id as string }

  const title = cleanText(recipe.name, 'Untitled Guide')
  let guideId: string | null = null
  let createdGuide = false

  if (recipe.auto_guide_id) {
    const { data: autoGuide, error: autoError } = await supabase
      .from('guides')
      .select('id, guide_decks(recipe_id)')
      .eq('id', recipe.auto_guide_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (autoError) throw new Error(autoError.message)
    const members = (autoGuide?.guide_decks ?? []) as { recipe_id: string }[]
    // Only an auto-guide that still wraps just this deck becomes its guide.
    if (autoGuide && members.length > 0 && members.every((member) => member.recipe_id === deckId)) {
      const { error: flipError } = await supabase
        .from('guides')
        .update({ is_auto: false, title })
        .eq('id', autoGuide.id)
        .eq('user_id', user.id)
      if (flipError) throw new Error(flipError.message)
      guideId = autoGuide.id as string
    }
  }

  if (!guideId) {
    const { data: guide, error: guideError } = await supabase
      .from('guides')
      .insert({ user_id: user.id, title, description: recipe.description?.trim() || null, is_auto: false, visibility: recipe.is_public ? 'public' : 'private' })
      .select('id')
      .single()
    if (guideError || !guide) throw new Error(guideError?.message || 'Could not open this guide')
    guideId = guide.id as string
    createdGuide = true
    // The guide_decks trigger pins this deck as the guide's likes/saves deck.
    const { error: linkError } = await supabase
      .from('guide_decks')
      .insert({ guide_id: guideId, recipe_id: deckId, user_id: user.id, position: 0 })
    if (linkError) throw new Error(linkError.message)
  }

  const { data: claimed, error: claimError } = await supabase
    .from('recipes')
    .update({ inline_guide_id: guideId })
    .eq('id', deckId)
    .eq('user_id', user.id)
    .is('inline_guide_id', null)
    .select('id')
  if (claimError) throw new Error(claimError.message)

  if (!claimed?.length) {
    // Upgraded concurrently (e.g. a second tab): keep the other guide.
    if (createdGuide) await supabase.from('guides').delete().eq('id', guideId).eq('user_id', user.id)
    const { data: current } = await supabase.from('recipes').select('inline_guide_id').eq('id', deckId).maybeSingle()
    if (!current?.inline_guide_id) throw new Error('Could not open this guide')
    return { guideId: current.inline_guide_id as string }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'deck_upgraded_to_guide',
    properties: { deck_id: deckId, guide_id: guideId, reused_auto_guide: !createdGuide },
  })
  revalidatePath('/guides')
  revalidatePath(`/guides/${guideId}`)
  return { guideId }
}

// A guide's direct cards live in its inline deck (recipes.inline_guide_id).
// Returns that deck, creating it on first use and adding it to the guide's
// decks - last, so likes, the cover and the first-deck fallbacks stay on the
// guides reused inside. It starts with no cover card, and public only when
// the guide already is.
export async function ensureInlineGuideDeck(guideId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!guideId) throw new Error('Missing guide id')

  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .select('id, title, guide_decks(recipe_id, position, recipes(is_public))')
    .eq('id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (guideError) throw new Error(guideError.message)
  if (!guide) throw new Error('Guide not found')

  const { data: existing, error: existingError } = await supabase
    .from('recipes')
    .select('id')
    .eq('inline_guide_id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)

  const members = (guide.guide_decks ?? []) as { recipe_id: string; position: number | null; recipes: { is_public: boolean | null } | { is_public: boolean | null }[] | null }[]
  let deckId = existing?.id as string | undefined
  if (!deckId) {
    const guideIsPublic = members.some((member) => {
      const recipe = Array.isArray(member.recipes) ? member.recipes[0] : member.recipes
      return recipe?.is_public === true
    })
    const { data: created, error: createError } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        name: cleanText(guide.title, 'Guide') + ' - cards',
        description: null,
        is_public: guideIsPublic,
        cover_position: null,
        inline_guide_id: guideId,
      })
      .select('id')
      .single()
    if (createError || !created) throw new Error(createError?.message || 'Could not add cards to this guide')
    deckId = created.id as string
  }

  if (!members.some((member) => member.recipe_id === deckId)) {
    const position = members.reduce((max, member) => Math.max(max, member.position ?? 0), -1) + 1
    const { error: linkError } = await supabase
      .from('guide_decks')
      .insert({ guide_id: guideId, recipe_id: deckId, user_id: user.id, position })
    if (linkError) throw new Error(linkError.message)
  }

  revalidatePath(`/guides/${guideId}`)
  return { deckId }
}

// New Card in the guide editor: adds one card of the chosen type to the end
// of the guide's own cards (creating its inline deck on first use) and
// returns that deck's fresh detail so the editor can show it in place.
export async function addInlineGuideCard(guideId: string, template: string) {
  if (!isCardTypeId(template) || template === 'cover') throw new Error('Choose a card type.')
  const { deckId } = await ensureInlineGuideDeck(guideId)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: lastStep, error: lastStepError } = await supabase
    .from('recipe_steps')
    .select('step_number')
    .eq('recipe_id', deckId)
    .order('step_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastStepError) throw new Error(lastStepError.message)

  const card: CreateDeckCardInput = {
    template,
    title: `${cardTypeLabel(template)} Card`,
    body: cardTypeDefaultBody(template),
    image: null,
  }
  const { data: inserted, error: insertError } = await insertRecipeSteps(supabase, [{
    recipe_id: deckId,
    user_id: user.id,
    step_number: (lastStep?.step_number ?? 0) + 1,
    title: card.title,
    // Type B is restored from its OG_DECK_CARD_META instructions.
    card_template: template === 'theme-alt' ? null : safeCardTemplate(template),
    instructions: encodeDeckCardInstructions(card),
    image_url: null,
    youtube_url: null,
    image_focal_x: 50,
    image_focal_y: 50,
    subtitle: safeThemeSubtitle(card),
  }])
  if (insertError || !inserted?.length) throw new Error(insertError?.message || 'Could not add this card.')

  revalidatePath(`/guides/${guideId}`)
  const { getGuidesV3DeckDetail } = await import('./guides-v3-detail-data')
  const deck = await getGuidesV3DeckDetail(deckId, user.id)
  if (!deck) throw new Error('Could not load the new card.')
  return { deckId, stepId: inserted[0].id as string, deck }
}

export async function loadGuideEditorDeck(deckId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { getGuidesV3DeckDetail } = await import('./guides-v3-detail-data')
  const deck = await getGuidesV3DeckDetail(deckId, user.id)
  if (!deck?.isOwner) throw new Error('You can only add your own decks to a guide.')
  return deck
}

// The guide's inline deck and one of its steps, both owned by the signed-in
// user - the only rows the single-card saves below may touch.
async function ownedInlineGuideStep(guideId: string, stepId: string | undefined) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!guideId || !stepId) throw new Error('Missing card')

  const { data: deck, error: deckError } = await supabase
    .from('recipes')
    .select('id')
    .eq('inline_guide_id', guideId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (deckError) throw new Error(deckError.message)
  if (!deck) throw new Error('Card not found')
  const deckId = deck.id as string

  const { data: step, error: stepError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('id', stepId)
    .eq('recipe_id', deckId)
    .maybeSingle()
  if (stepError) throw new Error(stepError.message)
  if (!step) throw new Error('Card not found')

  return { supabase, user, deckId, step: step as { id: string; step_number: number } }
}

async function inlineGuideCardResult(guideId: string, deckId: string, userId: string) {
  revalidatePath(`/guides/${guideId}`)
  revalidatePath(`/guides/decks/${deckId}`)
  const { getGuidesV3DeckDetail } = await import('./guides-v3-detail-data')
  const deck = await getGuidesV3DeckDetail(deckId, userId)
  if (!deck) throw new Error('Could not load this card.')
  return { deckId, deck }
}

// Edit on a guide's direct card: saves that one card in place - same step
// id and position, so guide layouts keep pointing at it - and replaces its
// paint links. Returns the inline deck's fresh detail for the editor.
export async function updateInlineGuideCard(guideId: string, card: CreateDeckCardInput) {
  if (card.template === 'cover' || card.template === 'title') throw new Error('Choose a card type.')
  const { supabase, user, deckId, step } = await ownedInlineGuideStep(guideId, card.id)

  const fields = deckCardStepFields(card, Math.max(0, (step.step_number ?? 1) - 1))
  const paintRows = deckCardPaintRows(step.id, user.id, card.paints)

  if (!await updateStep(supabase, deckId, step.id, fields)) {
    throw new Error('Could not save this card. Please try again.')
  }

  const { error: deletePaintsError } = await supabase
    .from('recipe_step_paints')
    .delete()
    .eq('recipe_step_id', step.id)
  if (deletePaintsError) throw new Error(deletePaintsError.message)

  if (paintRows.length) {
    const { error: paintsError } = await supabase.from('recipe_step_paints').insert(paintRows)
    if (paintsError) throw new Error(paintsError.message)
  }

  return inlineGuideCardResult(guideId, deckId, user.id)
}

// Delete Card on a guide's direct card. Like the deck editor, the guide's
// own cards keep at least one card. Later cards move up one step_number,
// lowest first, so a (recipe_id, step_number) uniqueness rule never collides.
export async function deleteInlineGuideCard(guideId: string, stepId: string) {
  const { supabase, user, deckId, step } = await ownedInlineGuideStep(guideId, stepId)

  const { data: siblings, error: siblingsError } = await supabase
    .from('recipe_steps')
    .select('id, step_number')
    .eq('recipe_id', deckId)
    .order('step_number', { ascending: true })
  if (siblingsError) throw new Error(siblingsError.message)
  if ((siblings ?? []).length <= 1) throw new Error('A guide keeps at least one of its own cards.')

  const { error: deletePaintsError } = await supabase
    .from('recipe_step_paints')
    .delete()
    .eq('recipe_step_id', step.id)
  if (deletePaintsError) throw new Error(deletePaintsError.message)

  const { data: deleted, error: deleteError } = await supabase
    .from('recipe_steps')
    .delete()
    .eq('id', step.id)
    .eq('recipe_id', deckId)
    .select('id')
  if (deleteError) throw new Error(deleteError.message)
  if (!deleted?.length) throw new Error('Could not delete this card. Please try again.')

  for (const later of (siblings ?? []).filter((row) => row.step_number > step.step_number)) {
    await updateStep(supabase, deckId, later.id as string, { step_number: (later.step_number as number) - 1 })
  }

  return inlineGuideCardResult(guideId, deckId, user.id)
}
