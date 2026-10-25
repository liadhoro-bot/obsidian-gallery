import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function compile(path) {
  return ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}

const source = compile('../app/guides/guides-v3-detail-data.ts')
const layout = {}
vm.runInNewContext(compile('../app/guides/shared/guide-card-layout.ts'), { exports: layout })

function fixture(shared) {
  const client = {
    from() {
      const query = {
        select() { return query }, eq() { return query },
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: { card_layout: [] }, error: null }),
      }
      return query
    },
  }
  const exports = {}
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'react') return { cache: fn => fn }
    if (name === './shared/guide-card-layout') return layout
    if (name === './guides-v3-data') return {
      getGuidesV3Payload: async () => ({ guideFiles: [], libraryGuides: [], nestableDecks: [], decks: [], libraryDecks: [] }),
      getSharedGuideFile: async () => shared,
    }
    if (name.endsWith('supabase/server')) return { createClient: async () => client }
    if (['./select-difficulty-compatible', './load-recipe-steps', './shared-read-client', '../components/social/data'].includes(name)) return {}
    throw new Error(name)
  } })
  return exports.getGuidesV3GuideDetail
}

test('signed-in visitors can open an unlisted guide absent from Discover and Saved', async () => {
  const guide = { id: 'unlisted', title: 'Shared by link', visibility: 'unlisted', deckIds: ['cards'], cards: 21 }
  const load = fixture({ guide, decks: [{ id: 'cards', inlineGuideId: 'unlisted' }] })
  const result = await load('unlisted', 'visitor')
  assert.equal(result.id, 'unlisted')
  assert.equal(result.cards, 21)
  assert.equal(result.decksList[0].id, 'cards')
  assert.equal(result.decksList[0].isInline, true)
})

test('missing or non-shareable guides remain unavailable to unrelated members', async () => {
  assert.equal(await fixture(null)('private', 'visitor'), null)
})
