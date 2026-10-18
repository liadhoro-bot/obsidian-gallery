import type { SupabaseClient } from '@supabase/supabase-js'

// Saving a deck used to delete every recipe_step and insert fresh rows, so
// each save minted new step ids. guides.card_layout references steps by id,
// so every guide containing the deck silently lost its hidden cards and
// custom order. This keeps existing steps (and their ids) in place: cards
// that carry an existing step id are updated, new cards are inserted, and
// only cards the owner removed are deleted.

export type SyncedStepRow = {
  recipe_id: string
  user_id: string
  step_number: number
  title: string
  card_template?: string | null
  instructions: string
  image_url: string | null
  youtube_url?: string | null
  image_focal_x: number
  image_focal_y: number
  subtitle?: string | null
}

export type StepSyncPlan = {
  // Index into the saved card list -> the existing step id it keeps.
  kept: { index: number; id: string }[]
  inserted: number[]
  removedIds: string[]
}

// Only ids that already belong to this deck are reused; anything else
// (new:... editor ids, duplicates, ids from another deck) becomes an insert.
export function planRecipeStepSync(existingIds: string[], cardIds: Array<string | null | undefined>): StepSyncPlan {
  const available = new Set(existingIds)
  const kept: StepSyncPlan['kept'] = []
  const inserted: number[] = []
  cardIds.forEach((id, index) => {
    if (id && available.has(id)) {
      available.delete(id)
      kept.push({ index, id })
    } else {
      inserted.push(index)
    }
  })
  const keptIds = new Set(kept.map(step => step.id))
  return { kept, inserted, removedIds: existingIds.filter(id => !keptIds.has(id)) }
}

// Kept steps park above any real step_number while cards are added and
// removed, so a (recipe_id, step_number) uniqueness rule can never collide.
const PARKED_STEP_NUMBER_OFFSET = 100000
const optionalColumns = ['card_template', 'youtube_url'] as const

type InsertSteps<Row> = (rows: Row[]) => PromiseLike<{
  data: Array<{ id: string; step_number: number }> | null
  error: { message: string } | null
}>

export type StepSyncResult =
  | { status: 'synced'; stepIds: string[] }
  // The database accepted no step updates (no UPDATE permission on
  // recipe_steps). Nothing was changed; the caller falls back to the
  // legacy delete-and-reinsert save.
  | { status: 'unsupported' }

export async function syncRecipeSteps<Row extends SyncedStepRow>(
  supabase: SupabaseClient,
  {
    deckId,
    existingIds,
    cardIds,
    rows,
    insertSteps,
  }: {
    deckId: string
    existingIds: string[]
    cardIds: Array<string | null | undefined>
    // Final rows, index-aligned with cardIds, step_number already 1..N.
    rows: Row[]
    insertSteps: InsertSteps<Row>
  }
): Promise<StepSyncResult> {
  const plan = planRecipeStepSync(existingIds, cardIds)

  if (plan.kept.length) {
    const updated = await Promise.all(plan.kept.map(({ index, id }) => {
      const fields: Partial<SyncedStepRow> = { ...rows[index], step_number: PARKED_STEP_NUMBER_OFFSET + rows[index].step_number }
      delete fields.recipe_id
      delete fields.user_id
      return updateStep(supabase, deckId, id, fields)
    }))
    const changed = updated.filter(Boolean).length
    if (changed === 0) return { status: 'unsupported' }
    if (changed !== plan.kept.length) throw new Error('Could not save every card. Please try again.')
  }

  if (plan.removedIds.length) {
    const { error: paintsError } = await supabase.from('recipe_step_paints').delete().in('recipe_step_id', plan.removedIds)
    if (paintsError) throw new Error(paintsError.message)
    const { error } = await supabase.from('recipe_steps').delete().eq('recipe_id', deckId).in('id', plan.removedIds)
    if (error) throw new Error(error.message)
  }

  const stepIds: string[] = []
  for (const { index, id } of plan.kept) stepIds[index] = id

  if (plan.inserted.length) {
    const { data, error } = await insertSteps(plan.inserted.map(index => rows[index]))
    if (error) throw new Error(error.message)
    const idByNumber = new Map((data ?? []).map(row => [row.step_number, row.id]))
    for (const index of plan.inserted) {
      const id = idByNumber.get(rows[index].step_number)
      if (!id) throw new Error('Could not save every card. Please try again.')
      stepIds[index] = id
    }
  }

  if (plan.kept.length) {
    const settled = await Promise.all(plan.kept.map(({ index, id }) =>
      updateStep(supabase, deckId, id, { step_number: rows[index].step_number })))
    if (settled.some(ok => !ok)) throw new Error('Could not save the card order. Please try again.')
  }

  return { status: 'synced', stepIds }
}

// Returns whether the row was updated. Mirrors insertRecipeSteps: drop only
// an optional column the database reports as missing, then retry.
export async function updateStep(supabase: SupabaseClient, deckId: string, id: string, fields: Record<string, unknown>) {
  const values = { ...fields }
  const remaining = new Set<string>(optionalColumns)
  for (;;) {
    const { data, error } = await supabase.from('recipe_steps').update(values).eq('id', id).eq('recipe_id', deckId).select('id')
    const missing = [...remaining].find(column =>
      column in values && error?.message.includes(column) && (error.code === '42703' || error.code === 'PGRST204'))
    if (missing) {
      remaining.delete(missing)
      delete values[missing]
      continue
    }
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  }
}
