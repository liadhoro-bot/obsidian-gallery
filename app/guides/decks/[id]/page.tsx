import { notFound, redirect } from 'next/navigation'
import type { Recipe, RecipeImage, RecipeStep } from '../../shared/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuideSmallImageStepCard,
  RecipeGuideThemeStepCard,
  RecipeGuideVideoCard,
} from '../../shared/recipe-guide-cards'
import V3PerfIndicator from '../../../components/v3-perf-indicator'
import { getFeatureGuidesForPage } from '../../../components/feature-guide-data'
import { deckDetailFeatureGuides } from '../../../components/feature-guide-presets'
import { createPerfTimer } from '../../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import {
  getGuidesV3DeckDetail,
  type GuidesV3DeckDetail,
  type GuidesV3DeckStep,
} from '../../guides-v3-detail-data'
import DeckCardViewer, { type DeckCardEntry } from './deck-card-viewer'
import DeckEditPageClient from './deck-edit-page-client'
import DeckHeroActions from './deck-hero-actions'
import DeckShareMenu, { type ShareCardEntry } from '../../shared/deck-share-menu'

type DeckDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ edit?: string; preview?: string }>
}

type DeckGuidePaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  ratio_text?: string | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

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
  }
}

function toRecipeStep(step: GuidesV3DeckStep): RecipeStep {
  return {
    id: step.id,
    step_number: step.number,
    title: step.title,
    instructions: step.instructions,
    image_url: step.rawImage || step.image,
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

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const perf = createPerfTimer('/guides/decks/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { edit?: string; preview?: string }),
  ])
  const isEditing = resolvedSearchParams.edit === '1'

  if (!isUuid(id)) {
    redirect('/guides?preview=1')
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    const nextPath = isEditing
      ? `/guides/decks/${id}?preview=1&edit=1`
      : `/guides/decks/${id}?preview=1`

    redirect(
      `/login?next=${encodeURIComponent(nextPath)}&preview=1`
    )
  }

  const [deck, featureGuides] = await Promise.all([
    perf.measure('v3 deck detail data', () => getGuidesV3DeckDetail(id, user.id)),
    getFeatureGuidesForPage('/guides/decks/[id]', deckDetailFeatureGuides),
  ])
  perf.total()

  if (!deck) notFound()

  if (isEditing && !deck.isOwner) {
    // Only the creator may edit a deck. A viewer who merely saved/bookmarked
    // it (or is looking at any other public deck) gets bounced to the
    // read-only view instead of the editor.
    redirect(`/guides/decks/${id}?preview=1`)
  }

  if (isEditing) {
    const { data: notesRow } = await supabase
      .from('recipes')
      .select('inventory_required, expert_tips')
      .eq('id', id)
      .maybeSingle()

    return (
      <main>
        <V3PerfIndicator surface="deck-editor" detail="main" />
        <DeckEditPageClient
          deck={deck}
          featureGuides={featureGuides}
          initialInventoryNotes={notesRow?.inventory_required ?? ''}
          initialExpertTips={notesRow?.expert_tips ?? ''}
        />
      </main>
    )
  }

  const recipe = toRecipe(deck)
  // Both the live swipeable viewer and the shared/exported cards (PDF,
  // images) should always show each step's own full-resolution photo, never
  // the small 112x112 thumbnail used for list/card previews elsewhere -
  // showBrandMark only toggles the "made with Obsidian Gallery" watermark.
  const featuredImage = toFeaturedImage(deck)
  const paintCount = deck.paintList.length
  const recipeSteps = deck.steps.map((step) => toRecipeStep(step))

  const renderStepCard = (step: GuidesV3DeckStep, showBrandMark: boolean) => {
    const recipeStep = toRecipeStep(step)
    const paints = toRecipePaints(step)

    return step.template === 'video' ? (
      <RecipeGuideVideoCard
        title={step.title}
        description={step.instructions}
        youtubeUrl={step.videoUrl}
        showBrandMark={showBrandMark}
      />
    ) : isThemeTemplateStep(step, recipeStep.image_url) ? (
      <RecipeGuideThemeStepCard
        step={recipeStep}
        stepsLength={recipeSteps.length}
        paints={paints}
        fallbackImageUrl={deck.fullImage || deck.image}
        showBrandMark={showBrandMark}
      />
    ) : step.template === 'small-image' && isUsableImageUrl(recipeStep.image_url) ? (
      <RecipeGuideSmallImageStepCard
        step={recipeStep}
        stepsLength={recipeSteps.length}
        paints={paints}
        showBrandMark={showBrandMark}
      />
    ) : isUsableImageUrl(recipeStep.image_url) ? (
      <RecipeGuideImageStepCard
        step={recipeStep}
        stepsLength={recipeSteps.length}
        paints={paints}
        showBrandMark={showBrandMark}
      />
    ) : (
      <RecipeGuideDescriptiveStepCard
        step={recipeStep}
        stepsLength={recipeSteps.length}
        paints={paints}
        showBrandMark={showBrandMark}
      />
    )
  }

  const shareCards: ShareCardEntry[] = [
    {
      key: 'cover',
      node: (
        <RecipeGuideCoverCard
          recipe={recipe}
          featuredImage={featuredImage}
          cardCount={deck.steps.length + 1}
          paintCount={paintCount}
          showBrandMark
        />
      ),
    },
    ...deck.steps.map((step) => ({
      key: step.id,
      node: renderStepCard(step, true),
    })),
  ]

  const cards: DeckCardEntry[] = [
    {
      key: 'cover',
      featureGuideTarget: 'guides.deck.cover',
      node: (
        <div className="relative h-full">
          <RecipeGuideCoverCard
            recipe={recipe}
            featuredImage={featuredImage}
            cardCount={deck.steps.length + 1}
            paintCount={paintCount}
          />
          <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
            <DeckHeroActions
              recipeId={deck.id}
              likeCount={deck.likeCount ?? 0}
              saveCount={deck.saveCount ?? 0}
              viewerHasLiked={deck.viewerHasLiked ?? false}
              viewerHasSaved={deck.viewerHasSaved ?? false}
            />
            <DeckShareMenu
              cards={shareCards}
              fileBaseName={deck.title}
              sharePath={`/guides/decks/${deck.id}`}
            />
          </div>
        </div>
      ),
    },
    ...deck.steps.map((step) => ({
      key: step.id,
      featureGuideTarget: 'guides.deck.steps',
      node: renderStepCard(step, false),
    })),
  ]

  return (
    <main>
      <V3PerfIndicator surface="deck-detail" detail="main" />
      <DeckCardViewer
        cards={cards}
        title={deck.title}
        backHref="/guides?preview=1"
        featureGuides={featureGuides}
      />
    </main>
  )
}
