'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'
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
  image: string | null
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
  saved: boolean
  accent: string
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
  const fileName = `${user.id}/deck-editor/${Date.now()}-${crypto.randomUUID()}.${extension}`

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

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name: title,
      description,
      image_url: coverImage,
      is_public: isPublic,
    })
    .select('id, name, image_url')
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
    saved: true,
    accent: accentFor(recipe.id),
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

  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .update({
      name: title,
      description,
      image_url: coverImage,
      is_public: isPublic,
    })
    .eq('id', deckId)
    .eq('user_id', user.id)
    .select('id, name, image_url')
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
    saved: true,
    accent: accentFor(recipe.id),
  }
}
