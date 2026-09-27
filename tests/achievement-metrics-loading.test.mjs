import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../lib/achievements/achievementMetrics.ts', import.meta.url))], bundle: true, write: false,
  platform: 'node', format: 'esm', plugins: [{
    name: 'server-only', setup(buildApi) {
      buildApi.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only', namespace: 'empty' }))
      buildApi.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' }))
    },
  }],
})
const { calculateAchievementMetrics } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

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

test('precomputed snapshot replaces achievement query fan-out', async () => {
  const requests = []
  const client = { from(table) {
    const query = {
      select() { return query },
      eq() { return query },
      then(resolve) {
        requests.push(table)
        return Promise.resolve({ error: null, data: [{
          achievement_metrics: { units_created_total: 8, painting_minutes_total: 90 },
          painting_days: ['2026-09-26', '2026-09-27'], metadata: {},
        }] }).then(resolve)
      },
    }
    return query
  } }
  const result = await calculateAchievementMetrics(client, 'owner')
  assert.deepEqual(requests, ['dashboard_progress_snapshots'])
  assert.equal(result.metrics.units_created_total, 8)
  assert.equal(result.metrics.painting_minutes_total, 90)
  assert.equal(result.metrics.consecutive_painting_days, 2)
  assert.equal(result.sessions.length, 2)
})
