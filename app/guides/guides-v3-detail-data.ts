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
  template: string | null
  instructions: string
  image: string | null
  videoUrl: string | null
  paints: GuidesV3DeckStepPaint[]
}

export type GuidesV3DeckPaint = {
  id: string
  name: string
  brand: string
  line: string
  color: string
  swatchImageUrl: string | null
  isOwned: boolean
  isWishlist: boolean
}

export type GuidesV3DeckStepPaint = GuidesV3DeckPaint & {
  ratioText: string | null
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
  card_template: string | null
  instructions: string | null
  image_url: string | null
  youtube_url: string | null
}

type StepPaintRow = {
  id: string
  recipe_step_id: string
  paint_order: number | null
  ratio_text: string | null
  paint_source: string | null
  catalog_paint?: {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
  }[] | {
    id: string
    brand: string | null
    line: string | null
    name: string | null
    hex_approx: string | null
    swatch_image_url: string | null
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

type SupabaseErrorLike = {
  code?: string
  message?: string
}

function isMissingColumn(error: SupabaseErrorLike | null | undefined, column: string) {
  const message = error?.message ?? ''

  return (
    error?.code === '42703' ||
    (message.includes(column) &&
      (message.includes('does not exist') || message.includes('schema cache')))
  )
}

function firstValue<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function clean(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function isYoutubeUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return false

  try {
    const parsed = new URL(trimmed)
    return (
      parsed.hostname === 'youtube.com' ||
      parsed.hostname.endsWith('.youtube.com') ||
      parsed.hostname === 'youtu.be'
    )
  } catch {
    return false
  }
}

const deckCardMetaPrefix = 'OG_DECK_CARD_META:'

function parseDeckCardMetaTemplate(value: unknown) {
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

  return null
}

function parseDeckCardInstructions(value: string | null | undefined) {
  const text = value ?? ''
  const [firstLine = '', ...rest] = text.split(/\r?\n/)

  if (!firstLine.startsWith(deckCardMetaPrefix)) {
    return {
      instructions: text,
      template: null as string | null,
      videoUrl: null as string | null,
    }
  }

  try {
    const metadata = JSON.parse(firstLine.slice(deckCardMetaPrefix.length)) as {
      template?: unknown
      youtubeUrl?: unknown
    }
    const body = rest.join('\n').replace(/^\s+/, '')
    const youtubeUrl =
      typeof metadata.youtubeUrl === 'string' &&
      isYoutubeUrl(metadata.youtubeUrl)
        ? metadata.youtubeUrl
        : null

    return {
      instructions: body,
      template: parseDeckCardMetaTemplate(metadata.template),
      videoUrl: youtubeUrl,
    }
  } catch {
    return {
      instructions: text,
      template: null as string | null,
      videoUrl: null as string | null,
    }
  }
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
    const rawImagePromise = loadRecipeImage(supabase, typedRecipe)
    let { data: steps, error: stepsError } = await supabase
      .from('recipe_steps')
      .select('id, step_number, title, card_template, instructions, image_url, youtube_url')
      .eq('recipe_id', deckId)
      .order('step_number', { ascending: true })

    if (isMissingColumn(stepsError, 'youtube_url')) {
      const fallbackResult = await supabase
        .from('recipe_steps')
        .select('id, step_number, title, card_template, instructions, image_url')
        .eq('recipe_id', deckId)
        .order('step_number', { ascending: true })

      steps =
        fallbackResult.data?.map((step) => ({
          ...step,
          youtube_url: null,
        })) ?? null
      stepsError = fallbackResult.error
    }

    if (isMissingColumn(stepsError, 'card_template')) {
      const fallbackResult = await supabase
        .from('recipe_steps')
        .select('id, step_number, title, instructions, image_url')
        .eq('recipe_id', deckId)
        .order('step_number', { ascending: true })

      steps =
        fallbackResult.data?.map((step) => ({
          ...step,
          card_template: null,
          youtube_url: null,
        })) ?? null
      stepsError = fallbackResult.error
    }

    const rawImage = await rawImagePromise

    if (stepsError) throw new Error(stepsError.message)

    const typedSteps = (steps ?? []) as StepRow[]
    const stepIds = typedSteps.map((step) => step.id)
    const { data: stepPaintLinks, error: stepPaintError } =
      stepIds.length > 0
        ? await supabase
            .from('recipe_step_paints')
            .select(
              `
              id,
              recipe_step_id,
              paint_order,
              ratio_text,
              paint_source,
              catalog_paint:paint_catalog_id (
                id,
                brand,
                line,
                name,
                hex_approx,
                swatch_image_url
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
            .order('paint_order', { ascending: true })
        : { data: [], error: null }

    if (stepPaintError) throw new Error(stepPaintError.message)

    const paintsById = new Map<string, GuidesV3DeckPaint>()
    const paintsByStepId = new Map<string, GuidesV3DeckStepPaint[]>()

    function addStepPaint(stepId: string, paint: GuidesV3DeckPaint, ratioText: string | null) {
      paintsById.set(paint.id, paint)
      const existing = paintsByStepId.get(stepId) ?? []
      existing.push({
        ...paint,
        ratioText,
      })
      paintsByStepId.set(stepId, existing)
    }

    for (const link of (stepPaintLinks ?? []) as StepPaintRow[]) {
      const catalogPaint = firstValue(link.catalog_paint)
      const customPaint = firstValue(link.custom_paint)

      if (catalogPaint) {
        addStepPaint(link.recipe_step_id, {
          id: `catalog:${catalogPaint.id}`,
          name: clean(catalogPaint.name, 'Unnamed Paint'),
          brand: clean(catalogPaint.brand, 'Catalog'),
          line: clean(catalogPaint.line, 'Paint'),
          color: catalogPaint.hex_approx || '#17b9c2',
          swatchImageUrl: catalogPaint.swatch_image_url,
          isOwned: false,
          isWishlist: false,
        }, link.ratio_text)
      } else if (customPaint) {
        addStepPaint(link.recipe_step_id, {
          id: `custom:${customPaint.id}`,
          name: clean(customPaint.name, 'Custom Paint'),
          brand: clean(customPaint.manufacturer, 'Custom'),
          line: clean(customPaint.series, 'Mix'),
          color: customPaint.color_hex || '#d8bd83',
          swatchImageUrl: null,
          isOwned: false,
          isWishlist: false,
        }, link.ratio_text)
      }
    }

    const catalogPaintIds = Array.from(paintsById.keys())
      .filter((id) => id.startsWith('catalog:'))
      .map((id) => id.slice('catalog:'.length))

    const { data: ownershipRows, error: ownershipError } =
      catalogPaintIds.length > 0
        ? await supabase
            .from('user_paint_ownership')
            .select('paint_catalog_id, is_owned, is_wishlist')
            .eq('user_id', userId)
            .in('paint_catalog_id', catalogPaintIds)
        : { data: [], error: null }

    if (ownershipError) throw new Error(ownershipError.message)

    const ownershipByPaintId = new Map(
      ((ownershipRows ?? []) as {
        paint_catalog_id: string
        is_owned: boolean | null
        is_wishlist: boolean | null
      }[]).map((row) => [row.paint_catalog_id, row])
    )

    for (const [id, paint] of paintsById) {
      const catalogId = id.startsWith('catalog:') ? id.slice('catalog:'.length) : null
      const ownership = catalogId ? ownershipByPaintId.get(catalogId) : undefined
      if (ownership) {
        paintsById.set(id, {
          ...paint,
          isOwned: ownership.is_owned === true,
          isWishlist: ownership.is_wishlist === true,
        })
      }
    }

    for (const [stepId, stepPaints] of paintsByStepId) {
      paintsByStepId.set(
        stepId,
        stepPaints.map((stepPaint) => {
          const updated = paintsById.get(stepPaint.id)
          return updated ? { ...updated, ratioText: stepPaint.ratioText } : stepPaint
        })
      )
    }

    const paints = Array.from(paintsById.values())

    const normalizedSteps = typedSteps.map((step, index) => {
      const hasCompatVideoUrl = isYoutubeUrl(step.image_url)
      const parsedInstructions = parseDeckCardInstructions(step.instructions)
      const template =
        step.card_template ??
        parsedInstructions.template ??
        (hasCompatVideoUrl ? 'video' : null)
      const usesCompatVideoUrl = template === 'video' && hasCompatVideoUrl
      const videoUrl =
        step.youtube_url ||
        parsedInstructions.videoUrl ||
        (usesCompatVideoUrl ? step.image_url : null)

      return {
        id: step.id,
        number: step.step_number ?? index + 1,
        title: clean(step.title, `Card ${index + 1}`),
        template,
        instructions: clean(parsedInstructions.instructions, 'No instructions yet.'),
        image: !usesCompatVideoUrl && step.image_url
          ? getGuideDeckThumbnail(step.image_url, fallbackImage)
          : null,
        videoUrl,
        paints: paintsByStepId.get(step.id) ?? [],
      }
    })

    return {
      id: typedRecipe.id,
      title: clean(typedRecipe.name, 'Untitled Deck'),
      category: categoryFor(typedRecipe),
      cards: normalizedSteps.length + 1,
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
      steps: normalizedSteps,
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
