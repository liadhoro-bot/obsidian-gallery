import assert from 'node:assert/strict'
import test from 'node:test'
import { selectDifficultyCompatible } from '../app/guides/select-difficulty-compatible'

const selection = 'id, difficulty, guide_decks(recipes(id, difficulty, name))'

test('current schema keeps saved difficulty and makes only one request', async () => {
  const calls: string[] = []
  const result = { data: [{ id: 'guide', difficulty: 'Advanced' }], error: null }
  assert.equal(await selectDifficultyCompatible(selection, async fields => {
    calls.push(fields)
    return result
  }), result)
  assert.deepEqual(calls, [selection])
})

for (const error of [
  { code: '42703', message: 'column recipes.difficulty does not exist' },
  { code: '42703', message: 'column recipes_1.difficulty does not exist' },
  { code: '42703', message: 'column guides.difficulty does not exist' },
  { code: 'PGRST204', message: "Could not find the 'difficulty' column of 'recipes' in the schema cache" },
]) {
  test(`legacy schema retries optional metadata: ${error.message}`, async () => {
    const calls: string[] = []
    const data = [{ id: 'guide', guide_decks: [{ recipes: { id: 'deck', name: 'Basecoat' } }] }]
    const result = await selectDifficultyCompatible(selection, async fields => {
      calls.push(fields)
      return fields.includes('difficulty') ? { data: null, error } : { data, error: null }
    })
    assert.equal(result.error, null)
    assert.deepEqual(result.data, data)
    assert.deepEqual(calls, [selection, 'id, guide_decks(recipes(id, name))'])
  })
}

test('permission errors and unrelated missing columns are not hidden', async () => {
  for (const error of [
    { code: '42501', message: 'permission denied for recipes' },
    { code: '42703', message: 'column recipes.image_url does not exist' },
  ]) {
    let calls = 0
    const result = await selectDifficultyCompatible(selection, async () => {
      calls++
      return { data: null, error }
    })
    assert.equal(calls, 1)
    assert.equal(result.error, error)
  }
})

test('legacy guide schema can omit tags and difficulty in either error order', async () => {
  for (const firstMissing of ['tags', 'difficulty'] as const) {
    const calls: string[] = []
    const fullSelection = 'id, difficulty, tags, title'
    const result = await selectDifficultyCompatible(fullSelection, async fields => {
      calls.push(fields)
      const missing = fields.includes(firstMissing)
        ? firstMissing
        : fields.includes(firstMissing === 'tags' ? 'difficulty' : 'tags')
          ? firstMissing === 'tags' ? 'difficulty' : 'tags'
          : null
      return missing
        ? { data: null, error: { code: '42703', message: `column guides.${missing} does not exist` } }
        : { data: [{ id: 'guide', title: 'Legacy guide' }], error: null }
    })
    assert.equal(result.error, null)
    assert.deepEqual(result.data, [{ id: 'guide', title: 'Legacy guide' }])
    assert.equal(calls.length, 3)
    assert.equal(calls.at(-1), 'id, title')
  }
})

test('fallback failures are returned without an infinite retry', async () => {
  let calls = 0
  const error = { code: '42703', message: 'column recipes.difficulty does not exist' }
  const result = await selectDifficultyCompatible(selection, async () => {
    calls++
    return { data: null, error }
  })
  assert.equal(calls, 2)
  assert.equal(result.error, error)
})
