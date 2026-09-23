'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'
import { updatePaintOwnership } from '../../utils/paint-ownership/update-paint-ownership'
import { getGuideDeckThumbnail } from './guides-v3-data'
import {
  getSafeImageExtension,
  validateGalleryImageFile,
} from '../../utils/images/gallery-upload'

export type CreateDeckCardInput = {
  title: string
  template: string
  body: string
  image: string | null
  videoUrl?: string | null
  paints?: Array<{
    id: string
    ratio_text?: string | null
  }>
}

export type CreateDeckInput = {
  title: string
  description: string
  status: string
  difficulty?: string
  image: string | null
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

export type DeckEditorImageUploadResult = {
  url: string
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
  card_template?: string
  instructions: string
  image_url: string | null
  youtube_url: string | null
}

function cleanText(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function safePersistedImage(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return null
}

function safePersistedYoutubeUrl(value: string | null | undefined) {
  let trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('www.youtube.com/')) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.startsWith('youtube.com/')) {
    trimmed = `https://${trimmed}`
  }
  if (trimmed.startsWith('youtu.be/')) {
    trimmed = `https://${trimmed}`
  }

  try {
    const parsed = new URL(trimmed)
    const isYoutube =
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (parsed.hostname === 'youtube.com' ||
        parsed.hostname.endsWith('.youtube.com') ||
        parsed.hostname === 'youtu.be')

    if (!isYoutube) return null
    parsed.protocol = 'https:'

    return parsed.toString()
  } catch {
    return null
  }
}

const deckCardMetaPrefix = 'OG_DECK_CARD_META:'

function encodeDeckCardInstructions(card: CreateDeckCardInput) {
  const body = cleanText(card.body, 'No instructions yet.')
  const template = safeCardTemplate(card.template)
  const youtubeUrl =
    template === 'video' ? safePersistedYoutubeUrl(card.videoUrl) : null

  if (template === 'step') return body

  const metadata: {
    template: string
    youtubeUrl?: string
  } = { template }

  if (youtubeUrl) {
    metadata.youtubeUrl = youtubeUrl
  }

  return `${deckCardMetaPrefix}${JSON.stringify(metadata)}\n\n${body}`
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

function safeCardTemplate(value: string | null | undefined) {
  if (
    value === 'step' ||
    value === 'theme' ||
    value === 'image' ||
    value === 'small-image' ||
    value === 'paints' ||
    value === 'video'
  ) {
    return value
  }

  return 'step'
}

export async function uploadDeckEditorImage(
  formData: FormData
): Promise<DeckEditorImageUploadResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const file = formData.get('image')
  if (!(file instanceof File)) throw new Error('Choose an image to upload.')

  const validationError = validateGalleryImageFile(file)
  if (validationError) throw new Error(validationError)

  const extension = getSafeImageExtension(file.name)
  const fileName = `users/${user.id}/deck-editor/${Date.now()}-${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('obsidian-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw new Error(uploadError.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from('obsidian-images').getPublicUrl(fileName)

  return { url: publicUrl }
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

function parsePaintSelection(rawValue: string | null | undefined) {
  if (!rawValue || rawValue.startsWith('paint:')) return null

  if (rawValue.includes(':')) {
    const [source, id] = rawValue.split(':')

    if (source === 'catalog' && id) {
      return {
        paint_source: 'catalog',
        paint_catalog_id: id,
        custom_paint_id: null,
      }
    }

    if (source === 'custom' && id) {
      return {
        paint_source: 'custom',
        paint_catalog_id: null,
        custom_paint_id: id,
      }
    }
  }

  return {
    paint_source: 'catalog',
    paint_catalog_id: rawValue,
    custom_paint_id: null,
  }
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
  const coverCard = input.cards.find((card) =>
    card.template === 'title' || card.template === 'cover'
  )
  const coverImage = safePersistedImage(input.image ?? coverCard?.image)
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
    })
    .select('id, name, image_url, created_at')
    .single()

  if (recipeError || !recipe) {
    throw new Error(recipeError?.message || 'Could not create deck')
  }

  const stepCards = input.cards.filter((card) =>
    card.template !== 'title' && card.template !== 'cover'
  )
  const steps: RecipeStepInsert[] = stepCards.map((card, index) => {
    const youtubeUrl =
      card.template === 'video' ? safePersistedYoutubeUrl(card.videoUrl) : null

    return {
      recipe_id: recipe.id,
      user_id: user.id,
      step_number: index + 1,
      title: cleanText(card.title, `Card ${index + 1}`),
      card_template: safeCardTemplate(card.template),
      instructions: encodeDeckCardInstructions(card),
      image_url: safePersistedImage(card.image),
      youtube_url: youtubeUrl,
    }
  })

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

    return (card.paints ?? []).flatMap((paint, paintIndex) => {
      const parsedPaint = parsePaintSelection(paint.id)
      if (!parsedPaint) return []

      return {
        recipe_step_id: step.id,
        user_id: user.id,
        paint_source: parsedPaint.paint_source,
        paint_catalog_id: parsedPaint.paint_catalog_id,
        custom_paint_id: parsedPaint.custom_paint_id,
        paint_order: paintIndex + 1,
        ratio_text: paint.ratio_text?.trim() || null,
      }
    })
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
  const coverCard = input.cards.find((card) =>
    card.template === 'title' || card.template === 'cover'
  )
  const coverImage = safePersistedImage(input.image ?? coverCard?.image)
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

  const { data: existingSteps, error: existingStepsError } = await supabase
    .from('recipe_steps')
    .select('id')
    .eq('recipe_id', deckId)

  if (existingStepsError) throw new Error(existingStepsError.message)

  const existingStepIds = (existingSteps ?? []).map((step) => step.id)

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

  const stepCards = input.cards.filter((card) =>
    card.template !== 'title' && card.template !== 'cover'
  )
  const steps: RecipeStepInsert[] = stepCards.map((card, index) => {
    const youtubeUrl =
      card.template === 'video' ? safePersistedYoutubeUrl(card.videoUrl) : null

    return {
      recipe_id: deckId,
      user_id: user.id,
      step_number: index + 1,
      title: cleanText(card.title, `Card ${index + 1}`),
      card_template: safeCardTemplate(card.template),
      instructions: encodeDeckCardInstructions(card),
      image_url: safePersistedImage(card.image),
      youtube_url: youtubeUrl,
    }
  })

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

    return (card.paints ?? []).flatMap((paint, paintIndex) => {
      const parsedPaint = parsePaintSelection(paint.id)
      if (!parsedPaint) return []

      return {
        recipe_step_id: step.id,
        user_id: user.id,
        paint_source: parsedPaint.paint_source,
        paint_catalog_id: parsedPaint.paint_catalog_id,
        custom_paint_id: parsedPaint.custom_paint_id,
        paint_order: paintIndex + 1,
        ratio_text: paint.ratio_text?.trim() || null,
      }
    })
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
  title: string
  description: string
  image: string | null
  deckIds: string[]
  // A guide's own visibility is derived from its member decks' `is_public`
  // (see isGuidePublic in guides-v3-data.ts) - there is no separate
  // guides.status column. Setting status to 'Public' here publishes every
  // member deck in the same save; 'Draft'/'Private' leave decks untouched
  // rather than surprising the owner by un-publishing them.
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

  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .insert({
      user_id: user.id,
      title,
      description,
      image_url: image,
      difficulty,
      is_auto: false,
    })
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

  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .update({ title, description, image_url: image, difficulty })
    .eq('id', guideId)
    .eq('user_id', user.id)
    .select('id')
    .single()

  if (guideError || !guide) {
    throw new Error(guideError?.message || 'Could not save guide')
  }

  const { error: deleteError } = await supabase
    .from('guide_decks')
    .delete()
    .eq('guide_id', guideId)

  if (deleteError) throw new Error(deleteError.message)

  const { error: guideDecksError } = await supabase.from('guide_decks').insert(
    deckIds.map((recipeId, index) => ({
      guide_id: guideId,
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
