import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync(new URL('../../app/guides/guides-v3-data.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function loadModule(path) {
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require(name) { throw new Error(name) } })
  return exports
}

function fixture(rows, fail = false) {
  const calls = []
  const client = {
  // Save totals come from the aggregate recipe_save_counts RPC.
  rpc(fn) {
    calls.push({ table: `rpc:${fn}`, filters: [], range: null })
    return Promise.resolve({ data: [{ recipe_id: 'recipe-0', save_count: 1 }], error: null })
  },
  from(table) {
    const call = { table, filters: [], range: null }
    calls.push(call)
    const query = {
      select() { return query },
      eq(key, value) { call.filters.push([key, value]); return query },
      in() { return query },
      order() { return query },
      range(start, end) { call.range = [start, end]; return query },
      then(resolve, reject) {
        let data = []
        if (table === 'guides') {
          const owner = call.filters.find(([key]) => key === 'user_id')?.[1]
          data = rows.filter(row => row.user_id === owner).slice(call.range[0], call.range[1] + 1)
        } else if (table === 'recipe_likes' || table === 'saved_recipes') {
          data = [{ recipe_id: 'recipe-0' }]
        }
        return Promise.resolve({ data, error: fail && table === 'guides' ? { message: 'Query failed' } : null }).then(resolve, reject)
      },
    }
    return query
  } }
  const exports = {}
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'react') return { cache: fn => fn }
    if (name.endsWith('supabase/server')) return { createClient: async () => client }
    if (name.endsWith('supabase/service-role')) return { createServiceRoleClient: () => client }
    if (name.endsWith('shared-read-client')) return { createSharedReadClient: () => client }
    if (name.endsWith('supabase-image')) return { getSupabaseImageUrl: url => url }
    if (name === './select-difficulty-compatible') return { selectDifficultyCompatible: (selection, query) => query(selection) }
    // The collection rule and social key are the real modules under test.
    if (['./shared/creator-collection', './shared/guide-social-deck', './shared/guide-difficulty', './shared/guide-visibility'].includes(name)) return loadModule(`../../app/guides/${name.slice(2)}.ts`)
    throw new Error(name)
  }, URL })
  return { load: exports.getCreatorPublicGuides, calls }
}
function guide(index, owner = 'creator', isPublic = true, visibility = isPublic ? 'public' : 'private') {
  return { id: `guide-${index}`, user_id: owner, title: `Guide ${index}`, visibility, guide_decks: [{ recipes: {
    id: `recipe-${index}`, user_id: owner, name: 'Guide', description: 'Description', image_url: '/guide.png', is_public: isPublic,
  } }] }
}

test('creator collection excludes private guides and other creators, preserving social controls', async () => {
  const f = fixture([guide(0), guide(1, 'creator', false), guide(2, 'other')])
  const result = await f.load('creator', 'viewer')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'guide-0')
  assert.equal(result[0].subtitle, 'Description')
  assert.equal(result[0].image, '/guide.png')
  assert.equal(result[0].deckId, 'recipe-0')
  assert.equal(result[0].likeCount, 1)
  assert.equal(result[0].viewerHasSaved, true)
  for (const query of f.calls.filter(call => call.filters.length && call.table !== 'guides')) {
    assert.deepEqual(query.filters, [['user_id', 'viewer']])
  }
})

test('a guide pulled back to private or draft leaves the collection even though its decks stay public', async () => {
  const f = fixture([guide(0), guide(1, 'creator', true, 'private'), guide(2, 'creator', true, 'draft')])
  const result = await f.load('creator', 'viewer')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'guide-0')
})

test('creator collection includes guides beyond Discover and database page limits', async () => {
  const f = fixture(Array.from({ length: 103 }, (_, index) => guide(index)))
  const result = await f.load('creator', 'viewer')
  assert.equal(result.length, 103)
  assert.equal(result.at(-1).id, 'guide-102')
  assert.deepEqual(f.calls.filter(call => call.table === 'guides').map(call => call.range), [[0, 99], [100, 199]])
})

test('empty collections and query failures are handled explicitly', async () => {
  assert.equal((await fixture([]).load('creator', 'viewer')).length, 0)
  await assert.rejects(fixture([], true).load('creator', 'viewer'), /Query failed/)
})

test('a guide with direct cards is listed once and its inline deck never counts as a deck', async () => {
  const deck = { id: 'deck-a', user_id: 'creator', name: 'Deck A', description: 'D', image_url: '/a.png', is_public: true }
  const inline = { id: 'inline-1', user_id: 'creator', name: 'Inline', description: 'I', image_url: null, is_public: true, inline_guide_id: 'with-cards' }
  const rows = [
    { id: 'with-cards', user_id: 'creator', title: 'With cards', is_auto: false, visibility: 'public', guide_decks: [{ position: 0, recipes: deck }, { position: 1, recipes: inline }] },
    { id: 'auto-a', user_id: 'creator', title: 'Deck A', is_auto: true, visibility: 'public', guide_decks: [{ position: 0, recipes: deck }] },
  ]
  const { load } = fixture(rows)
  const guides = await load('creator', 'viewer')
  assert.equal(JSON.stringify(guides.map((item) => item.id)), JSON.stringify(['with-cards', 'auto-a']))
  assert.equal(guides.find((item) => item.id === 'with-cards').decks, 1)
})
