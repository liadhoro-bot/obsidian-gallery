import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'

test('dashboard snapshots are memory-only, account-scoped, bounded, and invalidatable', async () => {
  const { code } = await transform(readFileSync('app/dashboard/dashboard-return-store.ts', 'utf8'), { loader: 'ts', format: 'esm' })
  const store = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  let changes = 0
  const unsubscribe = store.subscribeDashboardReturn(() => changes++)
  const render = () => 'real units'
  store.rememberDashboardReturn('alice', render)
  assert.equal(store.getDashboardReturn(), null, 'wait for browser account confirmation')
  store.setDashboardReturnUser('alice')
  assert.equal(store.getDashboardReturn().render('/dashboard'), 'real units')
  store.setDashboardReturnUser('bob')
  assert.equal(store.getDashboardReturn(), null, 'account switch erases previous content')
  store.rememberDashboardReturn('alice', render)
  assert.equal(store.getDashboardReturn(), null, 'late response from previous account is ignored')
  store.rememberDashboardReturn('bob', render)
  assert.ok(store.getDashboardReturn())
  store.setDashboardReturnUser(null)
  assert.equal(store.getDashboardReturn(), null, 'sign-out erases content')
  store.setDashboardReturnUser('alice')
  store.rememberDashboardReturn('alice', render)
  store.clearDashboardReturn()
  assert.equal(store.getDashboardReturn(), null, 'mutation invalidation removes stale content')
  store.rememberDashboardReturn('alice', render)
  const now = Date.now
  try {
    const later = now() + 5 * 60 * 1000 + 1
    Date.now = () => later
    assert.equal(store.getDashboardReturn(), null, 'expired snapshots are not displayed')
  } finally { Date.now = now }
  assert.ok(changes > 0)
  unsubscribe()
})
