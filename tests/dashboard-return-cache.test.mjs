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
  store.rememberDashboardReturn('alice', 'painting-table', render)
  assert.equal(store.getDashboardReturn('painting-table'), null, 'wait for browser account confirmation')
  store.setDashboardReturnUser('alice')
  assert.equal(store.getDashboardReturn('painting-table').render('/dashboard'), 'real units')
  store.rememberDashboardReturn('alice', 'profile', () => 'real progress')
  assert.equal(store.getDashboardReturn('profile').render('/dashboard?tab=profile'), 'real progress')
  store.setDashboardReturnUser('bob')
  assert.equal(store.getDashboardReturn('painting-table'), null, 'account switch erases previous content')
  assert.equal(store.getDashboardReturn('profile'), null, 'account switch erases all tabs')
  store.rememberDashboardReturn('alice', 'painting-table', render)
  assert.equal(store.getDashboardReturn('painting-table'), null, 'late response from previous account is ignored')
  store.rememberDashboardReturn('bob', 'painting-table', render)
  assert.ok(store.getDashboardReturn('painting-table'))
  store.setDashboardReturnUser(null)
  assert.equal(store.getDashboardReturn('painting-table'), null, 'sign-out erases content')
  store.setDashboardReturnUser('alice')
  store.rememberDashboardReturn('alice', 'painting-table', render)
  store.clearDashboardReturn()
  assert.equal(store.getDashboardReturn('painting-table'), null, 'mutation invalidation removes stale content')
  store.rememberDashboardReturn('alice', 'painting-table', render)
  const now = Date.now
  try {
    const later = now() + 5 * 60 * 1000 + 1
    Date.now = () => later
    assert.equal(store.getDashboardReturn('painting-table'), null, 'expired snapshots are not displayed')
  } finally { Date.now = now }
  assert.ok(changes > 0)
  unsubscribe()
})
