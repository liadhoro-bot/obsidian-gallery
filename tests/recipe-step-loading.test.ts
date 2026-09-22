import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRecipeSteps } from '../app/guides/load-recipe-steps'

function fixture(missing: string[] = [], failure?: { code: string; message: string }) {
  const queries: string[][] = []
  const source = { id: 'step-1', step_number: 1, title: 'First coat', instructions: 'Thin layers', image_url: '/paint.webp', card_template: 'video', youtube_url: 'https://youtu.be/example' }
  const client = { from(table: string) {
    assert.equal(table, 'recipe_steps')
    return { select(selection: string) {
      const columns = selection.split(', ')
      queries.push(columns)
      return { eq(key: string, value: string) {
        assert.equal(key, 'recipe_id')
        assert.equal(value, 'owned-deck')
        return { async order(key: string, options: { ascending: boolean }) {
          assert.equal(key, 'step_number')
          assert.equal(options.ascending, true)
          const absent = missing.find(column => columns.includes(column))
          return { data: failure || absent ? null : [Object.fromEntries(Object.entries(source).filter(([key]) => columns.includes(key)))],
            error: failure ?? (absent ? { code: '42703', message: `column recipe_steps.${absent} does not exist` } : null) }
        } }
      } }
    } }
  } } as unknown as SupabaseClient
  return { client, queries, source }
}

test('current schema returns every step field with one query', async () => {
  const f = fixture()
  assert.deepEqual((await loadRecipeSteps(f.client, 'owned-deck')).data, [f.source])
  assert.equal(f.queries.length, 1)
})

for (const missing of [['card_template'], ['youtube_url'], ['card_template', 'youtube_url'], ['youtube_url', 'card_template']]) {
  test(`legacy schema missing ${missing.join(', ')} preserves supported fields`, async () => {
    const f = fixture(missing)
    const result = await loadRecipeSteps(f.client, 'owned-deck')
    assert.equal(result.error, null)
    assert.deepEqual(result.data, [{ ...f.source, ...Object.fromEntries(missing.map(key => [key, null])) }])
    assert.equal(f.queries.length, missing.length + 1)
  })
}

for (const failure of [
  { code: '42703', message: 'column recipe_steps.instructions does not exist' },
  { code: '42501', message: 'permission denied for table recipe_steps' },
]) {
  test(`does not hide or retry unrelated failure ${failure.code}`, async () => {
    const f = fixture([], failure)
    assert.equal((await loadRecipeSteps(f.client, 'owned-deck')).error, failure)
    assert.equal(f.queries.length, 1)
  })
}
