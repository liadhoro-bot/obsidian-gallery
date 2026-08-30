import { notFound, redirect } from 'next/navigation'
import type { Recipe, RecipeImage, RecipeStep } from '../../../recipes/[id]/components/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
} from '../../../recipes/[id]/components/recipe-guide-cards'
import V3PerfIndicator from '../../../components/v3-perf-indicator'
import { getFeatureGuidesForPage } from '../../../components/feature-guide-data'
import { deckDetailFeatureGuides } from '../../../components/feature-guide-presets'
import { hasV3PreviewSession } from '../../../../lib/v3-preview-server'
import { createPerfTimer } from '../../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import {
  getGuidesV3DeckDetail,
  type GuidesV3DeckDetail,
  type GuidesV3DeckStep,
} from '../../guides-v3-detail-data'
import DeckCardViewer, { type DeckCardEntry } from './deck-card-viewer'
import DeckEditorClient from './deck-editor-client'

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
  if (!isUsableImageUrl(deck.image)) return null

  return {
    id: `${deck.id}-cover`,
    image_url: deck.image,
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
    image_url: step.image,
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

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const perf = createPerfTimer('/guides/decks/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { edit?: string; preview?: string }),
  ])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)
  const isEditing = resolvedSearchParams.edit === '1'

  if (!isUuid(id)) {
    redirect('/guides?preview=1')
  }

  if (!isPreview) {
    redirect(`/recipes/${id}`)
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

  const deck = await perf.measure('v3 deck detail data', () =>
    getGuidesV3DeckDetail(id, user.id)
  )
  const featureGuides = await getFeatureGuidesForPage(
    '/guides/decks/[id]',
    deckDetailFeatureGuides
  )
  perf.total()

  if (!deck) notFound()

  if (isEditing) {
    return (
      <main>
        <V3PerfIndicator surface="deck-editor" detail="main" />
        <DeckEditorClient
          deck={deck}
          backHref="/guides?preview=1"
          featureGuides={featureGuides}
        />
      </main>
    )
  }

  const recipe = toRecipe(deck)
  const featuredImage = toFeaturedImage(deck)
  const paintCount = deck.paintList.length
  const recipeSteps = deck.steps.map(toRecipeStep)

  const cards: DeckCardEntry[] = [
    {
      key: 'cover',
      featureGuideTarget: 'guides.deck.cover',
      node: (
        <RecipeGuideCoverCard
          recipe={recipe}
          featuredImage={featuredImage}
          stepCount={recipeSteps.length}
          paintCount={paintCount}
        />
      ),
    },
    ...deck.steps.map((step) => {
      const recipeStep = toRecipeStep(step)
      const paints = toRecipePaints(step)

      return {
        key: step.id,
        featureGuideTarget: 'guides.deck.steps',
        node: isUsableImageUrl(recipeStep.image_url) ? (
          <RecipeGuideImageStepCard
            step={recipeStep}
            stepsLength={recipeSteps.length}
            paints={paints}
          />
        ) : (
          <RecipeGuideDescriptiveStepCard
            step={recipeStep}
            stepsLength={recipeSteps.length}
            paints={paints}
          />
        ),
      }
    }),
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
