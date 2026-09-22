import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Next supplies server-only at build time. Remove only that marker for this
// Node test; execute the actual metric loader with a controlled database client.
const source = readFileSync(new URL('../lib/achievements/achievementMetrics.ts', import.meta.url), 'utf8').replace("import 'server-only'", '')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { calculateAchievementMetrics } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('exact counts survive capped ID rows and shared reads retain ownership filters', async () => {
  const requests = []
  const client = { from(table) {
    const state = { table, columns: null, options: {}, filters: [] }
    const query = {
      select(columns, options = {}) { state.columns = columns; state.options = options; return query },
      eq(key, value) { state.filters.push(['eq', key, value]); return query },
      neq(key, value) { state.filters.push(['neq', key, value]); return query },
      in(key, value) { state.filters.push(['in', key, value]); return query },
      then(resolve, reject) {
        requests.push(state)
        const combined = state.columns === 'id' && state.options.count === 'exact' && !state.options.head
        return Promise.resolve({ error: null, data: combined ? [{ id: `${table}-1` }] : [],
          count: combined ? (table === 'units' ? 1501 : 1800) : 0 }).then(resolve, reject)
      },
    }
    return query
  } }
  const result = await calculateAchievementMetrics(client, 'owner')
  assert.equal(result.metrics.units_created_total, 1501)
  assert.equal(result.metrics.guides_created_total, 1800)
  for (const table of ['units', 'recipes']) {
    const calls = requests.filter(r => r.table === table)
    assert.equal(calls.length, 2, 'one combined ID/total request plus one filtered count')
    for (const call of calls) assert.ok(call.filters.some(f => f[0] === 'eq' && f[1] === 'user_id' && f[2] === 'owner'))
  }
  const dependent = requests.find(r => r.table === 'unit_progress_steps')
  assert.deepEqual(dependent.filters.find(f => f[1] === 'unit_id')[2], ['units-1'])
  assert.equal(result.metrics.units_completed_total, 0)
  assert.equal(result.metrics.guides_published_total, 0)
})
