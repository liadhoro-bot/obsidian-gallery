import 'server-only'

import { createClient } from '../../../utils/supabase/server'
import { getGuideDeckThumbnail } from '../../guides/guides-v3-data'
import type { GuidesV3DeckDetail } from '../../guides/guides-v3-detail-data'
import {
  forGuide,
  isGuideOwnedCard,
  parseGuideCardLayout,
  resolveGuideCards,
} from '../../guides/shared/guide-card-layout'
import type { UnitWorkflow, UnitWorkflowGuide, UnitWorkflowStep } from './unit-workflow-model'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type GuideRow = {
  id: string
  title: string | null
  image_url: string | null
  card_layout?: unknown
  guide_decks: { recipe_id: string; position: number | null }[] | null
}

type RecipeRow = {
  id: string
  name: string | null
  image_url: string | null
  cover_position: number | null
  inline_guide_id: string | null
}

type StepRow = {
  id: string
  recipe_id: string
  step_number: number | null
  title: string | null
  subtitle?: string | null
  instructions: string | null
  card_template?: string | null
}

type LeanStep = { id: string; number: number; title: string; template: string | null; hasText: boolean }
type LeanDeck = {
  id: string
  title: string
  image: string
  coverPosition: number | null
  inlineGuideId: string | null
  steps: LeanStep[]
}

const FALLBACK_IMAGE = '/onboarding/pains/tough-choices.jpeg'
const CARD_META_PREFIX = 'OG_DECK_CARD_META:'

// Cards that carry no work to tick off: the cover, the paint list and title
// dividers always; photo/theme/video cards only when they have no
// instructions (a photo card with real instructions is still a step).
const NEVER_TRACKED = new Set(['cover', 'paints', 'title'])
const TRACKED_WITH_TEXT = new Set(['image', 'theme', 'theme-alt', 'video'])

function isTrackableStep(step: LeanStep) {
  if (step.template && NEVER_TRACKED.has(step.template)) return false
  if (step.template && TRACKED_WITH_TEXT.has(step.template)) return step.hasText
  return true
}

// Same card-meta convention as the guide viewer (guides-v3-detail-data):
// an optional first line `OG_DECK_CARD_META:{"template":...}` before the body.
function parseInstructions(value: string | null) {
  const text = value ?? ''
  const [firstLine = '', ...rest] = text.split(/\r?\n/)
  if (!firstLine.startsWith(CARD_META_PREFIX)) return { template: null as string | null, body: text }
  try {
    const meta = JSON.parse(firstLine.slice(CARD_META_PREFIX.length)) as { template?: unknown }
    return {
      template: typeof meta.template === 'string' ? meta.template : null,
      body: rest.join('\n'),
    }
  } catch {
    return { template: null, body: text }
  }
}

function toLeanStep(row: StepRow, index: number): LeanStep {
  const parsed = parseInstructions(row.instructions)
  const number = row.step_number ?? index + 1
  return {
    id: row.id,
    number,
    title: row.title?.trim() || row.subtitle?.trim() || `Step ${number}`,
    template: row.card_template ?? parsed.template,
    hasText: Boolean(parsed.body.trim()),
  }
}

function isMissingRelation(error: { code?: string; message?: string } | null, name: string) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    Boolean(error?.message?.includes(name))
  )
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

async function loadSteps(supabase: SupabaseServerClient, deckIds: string[]) {
  if (!deckIds.length) return [] as StepRow[]
  const full = await supabase
    .from('recipe_steps')
    .select('id, recipe_id, step_number, title, subtitle, instructions, card_template')
    .in('recipe_id', deckIds)
    .order('step_number', { ascending: true })
  if (!full.error) return (full.data ?? []) as StepRow[]
  if (!isMissingColumn(full.error)) throw new Error(full.error.message)
  // Older schema without the optional card columns.
  const minimal = await supabase
    .from('recipe_steps')
    .select('id, recipe_id, step_number, title, instructions')
    .in('recipe_id', deckIds)
    .order('step_number', { ascending: true })
  if (minimal.error) throw new Error(minimal.error.message)
  return (minimal.data ?? []) as StepRow[]
}

/**
 * The unit's Next Steps checklist: every trackable card of the guides and
 * decks assigned to it, in assignment order (content_assignments by
 * created_at, then legacy stage guides), each guide in its own card order
 * (guides.card_layout, hidden cards left out). A card that appears in two
 * assigned guides is listed once, under the first. Reads only ids, titles and
 * order - the full guide viewer payload is far heavier and not needed here.
 */
export async function getUnitWorkflow(
  supabase: SupabaseServerClient,
  unitId: string,
  userId: string
): Promise<UnitWorkflow> {
  const [assignmentsResult, stageGuidesResult, completionsResult] = await Promise.all([
    supabase
      .from('content_assignments')
      .select('content_type, guide_id, recipe_id, created_at')
      .eq('target_type', 'unit')
      .eq('unit_id', unitId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('unit_stage_recipes')
      .select('recipe_id, created_at')
      .eq('unit_id', unitId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('unit_guide_step_completions')
      .select('recipe_step_id, completed_at')
      .eq('unit_id', unitId)
      .eq('user_id', userId),
  ])

  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message)
  if (stageGuidesResult.error) throw new Error(stageGuidesResult.error.message)
  const trackingAvailable = !isMissingRelation(completionsResult.error, 'unit_guide_step_completions')
  if (completionsResult.error && trackingAvailable) {
    throw new Error(completionsResult.error.message)
  }

  const completedAt = new Map(
    (completionsResult.data ?? []).map((row) => [
      row.recipe_step_id as string,
      row.completed_at as string,
    ])
  )

  const assignments = assignmentsResult.data ?? []
  const guideIds = [
    ...new Set(
      assignments.flatMap((row) =>
        row.content_type === 'guide' && row.guide_id ? [row.guide_id as string] : []
      )
    ),
  ]

  let guideRows: GuideRow[] = []
  if (guideIds.length) {
    const withLayout = await supabase
      .from('guides')
      .select('id, title, image_url, card_layout, guide_decks (recipe_id, position)')
      .in('id', guideIds)
    if (withLayout.error && !isMissingColumn(withLayout.error)) throw new Error(withLayout.error.message)
    if (withLayout.error) {
      const withoutLayout = await supabase
        .from('guides')
        .select('id, title, image_url, guide_decks (recipe_id, position)')
        .in('id', guideIds)
      if (withoutLayout.error) throw new Error(withoutLayout.error.message)
      guideRows = (withoutLayout.data ?? []) as GuideRow[]
    } else {
      guideRows = (withLayout.data ?? []) as GuideRow[]
    }
  }
  const guideById = new Map(guideRows.map((guide) => [guide.id, guide]))
  const deckIdsOf = (guide: GuideRow) =>
    (guide.guide_decks ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((link) => link.recipe_id)

  // Decks assigned on their own (or set on a legacy stage) that are not
  // already part of an assigned guide.
  const deckIdsInGuides = new Set(guideRows.flatMap(deckIdsOf))
  const standaloneDeckIds = [
    ...new Set([
      ...assignments.flatMap((row) =>
        row.content_type === 'deck' && row.recipe_id ? [row.recipe_id as string] : []
      ),
      ...(stageGuidesResult.data ?? []).map((row) => row.recipe_id as string),
    ]),
  ].filter((deckId) => !deckIdsInGuides.has(deckId))

  const allDeckIds = [...new Set([...deckIdsInGuides, ...standaloneDeckIds])]
  const [recipesResult, stepRows] = await Promise.all([
    allDeckIds.length
      ? supabase
          .from('recipes')
          .select('id, name, image_url, cover_position, inline_guide_id')
          .in('id', allDeckIds)
      : Promise.resolve({ data: [] as RecipeRow[], error: null }),
    loadSteps(supabase, allDeckIds),
  ])
  if (recipesResult.error) throw new Error(recipesResult.error.message)

  const stepsByDeck = new Map<string, LeanStep[]>()
  for (const row of stepRows) {
    const list = stepsByDeck.get(row.recipe_id) ?? []
    list.push(toLeanStep(row, list.length))
    stepsByDeck.set(row.recipe_id, list)
  }
  // RLS keeps out decks the viewer can no longer read.
  const deckById = new Map<string, LeanDeck>(
    ((recipesResult.data ?? []) as RecipeRow[]).map((recipe) => [
      recipe.id,
      {
        id: recipe.id,
        title: recipe.name?.trim() || 'Untitled Guide',
        image: recipe.image_url ? getGuideDeckThumbnail(recipe.image_url, FALLBACK_IMAGE) : FALLBACK_IMAGE,
        coverPosition: recipe.cover_position,
        inlineGuideId: recipe.inline_guide_id,
        steps: stepsByDeck.get(recipe.id) ?? [],
      },
    ])
  )

  const guides: UnitWorkflowGuide[] = []
  const steps: UnitWorkflowStep[] = []
  const seenSteps = new Set<string>()

  function pushStep(guideKey: string, step: LeanStep) {
    if (seenSteps.has(step.id) || !isTrackableStep(step)) return 0
    seenSteps.add(step.id)
    const doneAt = completedAt.get(step.id) ?? null
    steps.push({
      id: step.id,
      guideKey,
      title: step.title,
      done: Boolean(doneAt),
      completedAt: doneAt,
    })
    return 1
  }

  function addGuide(guideId: string) {
    const guide = guideById.get(guideId)
    if (!guide) return
    const key = `guide:${guide.id}`
    const decks = forGuide(
      deckIdsOf(guide)
        .map((deckId) => deckById.get(deckId))
        .filter((deck): deck is LeanDeck => Boolean(deck)),
      guide.id
    )
    if (!decks.length) return
    // resolveGuideCards reads only id, steps[].id, coverPosition and isInline.
    const cards = resolveGuideCards(
      decks as unknown as GuidesV3DeckDetail[],
      parseGuideCardLayout(guide.card_layout)
    ).filter((card) => !card.hidden && !isGuideOwnedCard(card) && card.cardId !== 'cover')
    let count = 0
    for (const card of cards) {
      const step = deckById.get(card.deckId)?.steps.find((item) => item.id === card.cardId)
      if (step) count += pushStep(key, step)
    }
    const firstDeck = decks[0]
    guides.push({
      key,
      type: 'guide',
      id: guide.id,
      title: guide.title?.trim() || firstDeck.title,
      image: guide.image_url ? getGuideDeckThumbnail(guide.image_url, FALLBACK_IMAGE) : firstDeck.image,
      href: `/guides/${guide.id}?preview=1&view=1`,
      stepCount: count,
    })
  }

  function addDeck(deckId: string) {
    const deck = deckById.get(deckId)
    if (!deck) return
    const key = `deck:${deck.id}`
    let count = 0
    for (const step of deck.steps) count += pushStep(key, step)
    guides.push({
      key,
      type: 'deck',
      id: deck.id,
      title: deck.title,
      image: deck.image,
      href: `/guides/decks/${deck.id}?preview=1`,
      stepCount: count,
    })
  }

  const addedDecks = new Set<string>()
  const addDeckOnce = (deckId: string) => {
    if (addedDecks.has(deckId)) return
    addedDecks.add(deckId)
    addDeck(deckId)
  }
  for (const row of assignments) {
    if (row.content_type === 'guide' && row.guide_id) addGuide(row.guide_id as string)
    if (row.content_type === 'deck' && row.recipe_id && standaloneDeckIds.includes(row.recipe_id as string)) {
      addDeckOnce(row.recipe_id as string)
    }
  }
  for (const deckId of standaloneDeckIds) addDeckOnce(deckId)

  return {
    guides,
    steps,
    completed: steps.filter((step) => step.done).length,
    total: steps.length,
    trackingAvailable,
  }
}
