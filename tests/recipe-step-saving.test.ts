import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertRecipeSteps, type RecipeStepInsert } from '../app/guides/insert-recipe-steps'
import { hasUnuploadedImage, normalizeThemeSubtitle, themeSubtitleText } from '../app/guides/shared/deck-save-values'

const card: RecipeStepInsert = {
  recipe_id: 'deck', user_id: 'owner', step_number: 1,
  title: 'Prime', card_template: null,
  instructions: 'OG_DECK_CARD_META:{"template":"theme-alt","paintAlignment":"right"}\n\nPrime white',
  image_url: '/photo.jpg', youtube_url: null,
  image_focal_x: 32, image_focal_y: 68, subtitle: 'Preparation',
}

function database(missing: string[], failure?: { code: string; message: string }) {
  const attempts: Record<string, unknown>[][] = []
  let persisted: Record<string, unknown>[] = []
  const client = { from(table: string) {
    assert.equal(table, 'recipe_steps')
    return { insert(rows: Record<string, unknown>[]) {
      attempts.push(structuredClone(rows))
      return { async select() {
        const absent = missing.find(column => rows.some(row => column in row))
        if (failure || absent) return { data: null, error: failure ?? {
          code: 'PGRST204', message: `Could not find the '${absent}' column of 'recipe_steps' in the schema cache`,
        } }
        persisted = structuredClone(rows)
        return { data: rows.map(row => ({ id: 'saved-step', step_number: row.step_number })), error: null }
      } }
    } }
  } } as unknown as SupabaseClient
  return { client, attempts, reload: () => structuredClone(persisted) }
}

for (const missing of [[], ['card_template'], ['youtube_url'], ['card_template', 'youtube_url'], ['youtube_url', 'card_template']]) {
  test(`two save/reload cycles preserve all supported fields when missing ${missing.join(',') || 'nothing'}`, async () => {
    const db = database(missing)
    for (const subtitle of ['Preparation', 'Updated preparation', '', ' ']) {
      const input = { ...card, subtitle: normalizeThemeSubtitle('theme-alt', subtitle), image_url: '/replacement-photo.jpg' }
      const result = await insertRecipeSteps(db.client, [input])
      assert.equal(result.error, null)
      const expected = Object.fromEntries(Object.entries(input).filter(([key]) => !missing.includes(key)))
      assert.deepEqual(db.reload(), [expected])
      assert.equal(input.subtitle, subtitle.trim())
    }
  })
}

test('explicit blank subtitles remain blank while legacy null retains its default', () => {
  for (const input of ['', ' ', '\n  ']) {
    assert.equal(normalizeThemeSubtitle('theme-alt', input), '')
    assert.equal(themeSubtitleText(normalizeThemeSubtitle('theme-alt', input)), '')
  }
  assert.equal(themeSubtitleText(normalizeThemeSubtitle('theme', null)), 'Color Reference')
  assert.equal(normalizeThemeSubtitle('theme', ' Step 2 '), 'Step 2')
  assert.equal(normalizeThemeSubtitle('image', 'Step 2'), null)
})

test('unfinished or failed image uploads cannot be silently converted to a saved null image', () => {
  assert.equal(hasUnuploadedImage(['/saved.jpg', 'blob:local-preview']), true)
  assert.equal(hasUnuploadedImage(['data:image/png;base64,preview']), true)
  assert.equal(hasUnuploadedImage([null, '/saved.jpg', 'https://example.com/new-photo.jpg']), false)
})

for (const failure of [
  { code: '42703', message: 'column recipe_steps.subtitle does not exist' },
  { code: '42501', message: 'permission denied for table recipe_steps' },
  { code: '23514', message: 'new row violates check constraint' },
]) {
  test(`unrelated ${failure.code} failure is surfaced without dropping data or retrying`, async () => {
    const db = database([], failure)
    const result = await insertRecipeSteps(db.client, [card])
    assert.equal(result.error, failure)
    assert.equal(db.attempts.length, 1)
    assert.deepEqual(db.reload(), [])
  })
}
