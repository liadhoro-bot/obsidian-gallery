'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import { getGuideDeckThumbnail } from './guides-v3-data'

export type CreateDeckCardInput = {
  title: string
  template: string
  body: string
  image: string | null
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

function accentFor(seed: string) {
  const colors = ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#1e4f92']
  const index =
    seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    colors.length

  return colors[index] ?? colors[0]
}

function categoryFor(input: CreateDeckInput) {
  if (input.cards.some((card) => card.template === 'image')) return 'Image + Steps'
  if (input.cards.some((card) => card.template === 'paints')) return 'Paints'
  return 'Steps'
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
  const steps = stepCards.map((card, index) => ({
    recipe_id: recipe.id,
    user_id: user.id,
    step_number: index + 1,
    title: cleanText(card.title, `Card ${index + 1}`),
    instructions: cleanText(card.body, 'No instructions yet.'),
    image_url: safePersistedImage(card.image),
  }))

  let insertedSteps: Array<{ id: string; step_number: number }> = []

  if (steps.length) {
    const { data: stepRows, error: stepsError } = await supabase
      .from('recipe_steps')
      .insert(steps)
      .select('id, step_number')

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

  revalidatePath('/guides')
  revalidatePath('/recipes')

  return {
    id: recipe.id,
    title: cleanText(recipe.name, title),
    category: categoryFor(input),
    cards: stepCards.length,
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
