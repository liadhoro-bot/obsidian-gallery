import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Recipe, RecipeImage, RecipeStep } from '../../../recipes/[id]/components/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
} from '../../../recipes/[id]/components/recipe-guide-cards'
import V3PerfIndicator from '../../../components/v3-perf-indicator'
import { hasV3PreviewSession } from '../../../../lib/v3-preview-server'
import { createPerfTimer } from '../../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import {
  getGuidesV3DeckDetail,
  type GuidesV3DeckDetail,
  type GuidesV3DeckStep,
} from '../../guides-v3-detail-data'
import styles from '../../guide-detail-silver.module.css'

type DeckDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ preview?: string }>
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

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return url.startsWith('http://') || url.startsWith('https://')
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
    searchParams ?? Promise.resolve({} as { preview?: string }),
  ])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  if (!isPreview) {
    redirect(`/recipes/${id}`)
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/guides/decks/${id}?preview=1`)}&preview=1`
    )
  }

  const deck = await perf.measure('v3 deck detail data', () =>
    getGuidesV3DeckDetail(id, user.id)
  )
  perf.total()

  if (!deck) notFound()

  const recipe = toRecipe(deck)
  const featuredImage = toFeaturedImage(deck)
  const paintCount = deck.paintList.length
  const recipeSteps = deck.steps.map(toRecipeStep)

  return (
    <main className={styles.root}>
      <V3PerfIndicator surface="deck-detail" detail="main" />
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <Link
            href="/guides?preview=1"
            className={styles.backButton}
            aria-label="Back to guides"
          >
            <span>&lt;</span>
          </Link>
          <span className={styles.topLabel}>
            Deck
          </span>
          <span className={styles.topSpacer} aria-hidden="true" />
        </header>

        <section className={styles.cardStack} aria-label={`${deck.title} cards`}>
          <div className={styles.shareCardMount}>
            <RecipeGuideCoverCard
              recipe={recipe}
              featuredImage={featuredImage}
              stepCount={recipeSteps.length}
              paintCount={paintCount}
            />
          </div>
          {deck.steps.length ? (
            deck.steps.map((step) => {
              const recipeStep = toRecipeStep(step)
              const paints = toRecipePaints(step)

              return (
                <div key={step.id} className={styles.shareCardMount}>
                  {isUsableImageUrl(recipeStep.image_url) ? (
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
                  )}
                </div>
              )
            })
          ) : (
            <div className={styles.emptyPanel}>
              No cards have been added to this deck yet.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
