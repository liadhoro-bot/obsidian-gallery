import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { planRecipeStepSync, syncRecipeSteps, type SyncedStepRow } from '../app/guides/sync-recipe-steps'
import { resolveGuideCards, type GuideCardPlacement } from '../app/guides/shared/guide-card-layout'
import type { GuidesV3DeckDetail } from '../app/guides/guides-v3-detail-data'

type StepRecord = Record<string, unknown> & { id: string; recipe_id: string; step_number: number }

// In-memory recipe_steps / recipe_step_paints that enforce a
// (recipe_id, step_number) uniqueness rule, so a collision during
// renumbering fails the test instead of passing silently.
function database(initial: StepRecord[], { allowUpdates = true } = {}) {
  let steps = structuredClone(initial)
  let nextId = 1
  const unique = (rows: StepRecord[]) => new Set(rows.map(row => `${row.recipe_id}:${row.step_number}`)).size === rows.length
  const client = { from(table: string) {
    if (table === 'recipe_step_paints') return { delete: () => ({ in: async () => ({ error: null }) }) }
    assert.equal(table, 'recipe_steps')
    return {
      update(values: Record<string, unknown>) {
        const filters: Record<string, unknown> = {}
        const chain = {
          eq(column: string, value: unknown) { filters[column] = value; return chain },
          async select() {
            if (!allowUpdates) return { data: [], error: null }
            const next = steps.map(row => Object.entries(filters).every(([key, value]) => row[key] === value) ? { ...row, ...values } : row)
            if (!unique(next)) return { data: null, error: { code: '23505', message: 'duplicate step_number' } }
            const matched = steps.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value))
            steps = next
            return { data: matched.map(row => ({ id: row.id })), error: null }
          },
        }
        return chain
      },
      delete() {
        let recipeId: unknown
        return {
          eq(_column: string, value: unknown) { recipeId = value; return this },
          async in(_column: string, ids: string[]) {
            steps = steps.filter(row => !(row.recipe_id === recipeId && ids.includes(row.id)))
            return { error: null }
          },
        }
      },
    }
  } } as unknown as SupabaseClient
  const insertSteps = async (rows: SyncedStepRow[]) => {
    const inserted = rows.map(row => ({ ...row, id: `inserted-${nextId++}` }))
    if (!unique([...steps, ...inserted])) return { data: null, error: { message: 'duplicate step_number' } }
    steps.push(...inserted)
    return { data: inserted.map(row => ({ id: row.id, step_number: row.step_number })), error: null }
  }
  return { client, insertSteps, steps: () => [...steps].sort((a, b) => a.step_number - b.step_number) }
}

const row = (step_number: number, title: string): SyncedStepRow => ({
  recipe_id: 'deck', user_id: 'owner', step_number, title, card_template: null,
  instructions: title, image_url: null, youtube_url: null, image_focal_x: 50, image_focal_y: 50,
})
const existing = ['a', 'b', 'c'].map((id, index) => ({ ...row(index + 1, id.toUpperCase()), id }))

test('plan reuses only ids that belong to the deck, once each', () => {
  assert.deepEqual(planRecipeStepSync(['a', 'b', 'c'], ['c', 'new:1', 'a', 'a', 'other-deck', undefined]), {
    kept: [{ index: 0, id: 'c' }, { index: 2, id: 'a' }],
    inserted: [1, 3, 4, 5],
    removedIds: ['b'],
  })
})

test('editing, reordering, adding and removing cards keeps surviving step ids', async () => {
  const db = database(existing)
  // Reverse order, edit C, remove B, insert a new card in the middle.
  const result = await syncRecipeSteps(db.client, {
    deckId: 'deck', existingIds: ['a', 'b', 'c'], cardIds: ['c', 'new:x', 'a'],
    rows: [row(1, 'C edited'), row(2, 'New'), row(3, 'A')], insertSteps: db.insertSteps,
  })
  assert.deepEqual(result, { status: 'synced', stepIds: ['c', 'inserted-1', 'a'] })
  assert.deepEqual(db.steps().map(step => [step.id, step.step_number, step.title]), [
    ['c', 1, 'C edited'], ['inserted-1', 2, 'New'], ['a', 3, 'A'],
  ])
})

test('a guide keeps hidden cards and custom order after its deck is edited', async () => {
  const db = database(existing)
  const layout: GuideCardPlacement[] = [
    { deckId: 'deck', cardId: 'c', groupId: 'deck', hidden: false },
    { deckId: 'deck', cardId: 'a', groupId: 'deck', hidden: true },
    { deckId: 'deck', cardId: 'b', groupId: 'deck', hidden: false },
  ]
  await syncRecipeSteps(db.client, {
    deckId: 'deck', existingIds: ['a', 'b', 'c'], cardIds: ['a', 'b', 'c'],
    rows: [row(1, 'A v2'), row(2, 'B v2'), row(3, 'C v2')], insertSteps: db.insertSteps,
  })
  const deck = { id: 'deck', coverPosition: null, steps: db.steps().map(step => ({ id: step.id })) } as unknown as GuidesV3DeckDetail
  assert.deepEqual(resolveGuideCards([deck], layout), layout)
})

test('a database that rejects step updates changes nothing and reports unsupported', async () => {
  const db = database(existing, { allowUpdates: false })
  const result = await syncRecipeSteps(db.client, {
    deckId: 'deck', existingIds: ['a', 'b', 'c'], cardIds: ['a', 'new:x'],
    rows: [row(1, 'A'), row(2, 'New')], insertSteps: db.insertSteps,
  })
  assert.deepEqual(result, { status: 'unsupported' })
  assert.deepEqual(db.steps(), existing)
})
