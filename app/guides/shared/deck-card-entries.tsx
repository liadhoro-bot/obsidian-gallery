type DeckGuidePaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  ratio_text?: string | null
}
import type { Recipe, RecipeImage, RecipeStep } from './types'
import {
  RecipeGuideAltThemeStepCard,
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuidePaintsCard,
  RecipeGuideSmallImageStepCard,
  RecipeGuideThemeStepCard,
  RecipeGuideVideoCard,
} from '../shared/recipe-guide-cards'
import type { GuidesV3DeckDetail, GuidesV3DeckStep } from '../guides-v3-detail-data'

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    (url.startsWith('/') && !url.startsWith('//'))
  )
}

function toRecipe(deck: GuidesV3DeckDetail): Recipe {
  return {
    id: deck.id,
    name: deck.title,
    description: deck.description,
    inventory_required: null,
    expert_tips: null,
    youtube_url: null,
    is_public: deck.isPublic,
  }
}

function toFeaturedImage(deck: GuidesV3DeckDetail): RecipeImage | null {
  const image = deck.fullImage || deck.image
  if (!isUsableImageUrl(image)) return null

  return {
    id: `${deck.id}-cover`,
    image_url: image,
    is_featured: true,
    alt_text: deck.title,
    focal_x: deck.coverFocalX ?? 50,
    focal_y: deck.coverFocalY ?? 50,
  }
}

function toRecipeStep(step: GuidesV3DeckStep): RecipeStep {
  return {
    id: step.id,
    step_number: step.number,
    title: step.title,
    instructions: step.instructions,
    image_url: step.rawImage || step.image,
    image_focal_x: step.imageFocalX,
    image_focal_y: step.imageFocalY,
    paint_alignment: step.paintAlignment ?? 'left',
    subtitle: step.subtitle ?? null,
  }
}

function toRecipePaints(step: GuidesV3DeckStep): DeckGuidePaint[] {
  return step.paints.map((paint) => ({
    id: paint.id,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    hex_approx: paint.color,
    swatch_image_url: paint.swatchImageUrl,
    ratio_text: paint.ratioText,
  }))
}

function isThemeTemplateStep(step: GuidesV3DeckStep, imageUrl: string | null) {
  const lowerTitle = step.title.toLowerCase()
  const looksLikeTheme = lowerTitle.includes('theme') || lowerTitle.includes('palette')

  return (
    step.template === 'theme' ||
    (step.template === 'image' && looksLikeTheme) ||
    (!step.template && looksLikeTheme) ||
    (!step.template && Boolean(imageUrl) && step.paints.length >= 4)
  )
}

export function deckCardEntries(deck: GuidesV3DeckDetail) {
  const recipe = toRecipe(deck)
  const featuredImage = toFeaturedImage(deck)
  const paintCount = deck.paintList.length

  // Same "where does the cover belong, if at all" logic as the live
  // viewer (see app/guides/decks/[id]/page.tsx) - undefined defaults to
  // 0 (cover first) for decks that predate this column, null omits it.
  const rawCoverPosition = deck.coverPosition === undefined ? 0 : deck.coverPosition
  const coverPosition =
    rawCoverPosition === null
      ? null
      : Math.max(0, Math.min(rawCoverPosition, deck.steps.length))
  const cardCount = deck.steps.length + (coverPosition === null ? 0 : 1)

  const stepNodes = deck.steps.map((step) => {
    const recipeStep = toRecipeStep(step)
    const paints = toRecipePaints(step)

    return {
      key: step.id,
      node:
        step.template === 'video' ? (
          <RecipeGuideVideoCard
            title={step.title}
            description={step.instructions}
            youtubeUrl={step.videoUrl}
          />
        ) : step.template === 'paints' ? (
          <RecipeGuidePaintsCard
            title={step.title}
            description={step.instructions}
            paints={paints}
          />
        ) : step.template === 'theme-alt' ? (
          <RecipeGuideAltThemeStepCard
            step={recipeStep}
            stepsLength={deck.steps.length}
            paints={paints}
            fallbackImageUrl={deck.fullImage || deck.image}
            fallbackFocalX={deck.coverFocalX ?? 50}
            fallbackFocalY={deck.coverFocalY ?? 50}
          />
        ) : isThemeTemplateStep(step, recipeStep.image_url) ? (
          <RecipeGuideThemeStepCard
            step={recipeStep}
            stepsLength={deck.steps.length}
            paints={paints}
            fallbackImageUrl={deck.fullImage || deck.image}
            fallbackFocalX={deck.coverFocalX ?? 50}
            fallbackFocalY={deck.coverFocalY ?? 50}
          />
        ) : step.template === 'small-image' && isUsableImageUrl(recipeStep.image_url) ? (
          <RecipeGuideSmallImageStepCard
            step={recipeStep}
            stepsLength={deck.steps.length}
            paints={paints}
          />
        ) : isUsableImageUrl(recipeStep.image_url) ? (
          <RecipeGuideImageStepCard
            step={recipeStep}
            stepsLength={deck.steps.length}
            paints={paints}
          />
        ) : (
          <RecipeGuideDescriptiveStepCard
            step={recipeStep}
            stepsLength={deck.steps.length}
            paints={paints}
          />
        ),
    }
  })

  const coverNode =
    coverPosition === null ? null : (
      <RecipeGuideCoverCard
        recipe={recipe}
        featuredImage={featuredImage}
        cardCount={cardCount}
        paintCount={paintCount}
      />
    )

  const cardNodes =
    coverPosition === null
      ? stepNodes
      : [
          ...stepNodes.slice(0, coverPosition),
          { key: 'cover', node: coverNode },
          ...stepNodes.slice(coverPosition),
        ]

  return cardNodes
}
