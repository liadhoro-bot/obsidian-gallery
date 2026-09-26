import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

// Local production-build check. Hold RSC responses to prove feedback does not
// depend on authentication, database, or route-prefetch response timing.
const baseURL = 'http://127.0.0.1:3126'
const output = '.perf/navigation-feedback'
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3126'], { stdio: 'ignore', windowsHide: true })
let browser
const results = []
try {
  for (let attempt = 0; ; attempt++) {
    try { await fetch(baseURL + '/login'); break } catch {
      if (attempt > 60) throw new Error('Local server did not start')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL, viewport: { width: 430, height: 932 }, serviceWorkers: 'block', storageState: process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-flows.json' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const gates = new Map()
  function hold(name) {
    let release
    const promise = new Promise(resolve => { release = resolve })
    gates.set(name, { promise, release })
  }
  function release(name) { const gate = gates.get(name); gates.delete(name); gate?.release() }
  hold('dashboard'); hold('profile'); hold('project-detail')
  await page.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.headers().rsc === '1') {
      const name = url.pathname === '/dashboard' ? (url.searchParams.get('tab') === 'profile' ? 'profile' : 'dashboard') : url.pathname.startsWith('/projects/') ? 'project-detail' : ''
      if (gates.has(name)) await gates.get(name).promise
    }
    await route.continue().catch(() => {})
  })
  await page.goto('/projects?preview=1', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-v3-perf-indicator="projects"]').first().waitFor({ state: 'attached', timeout: 45000 })
  async function immediate(label, control, title) {
    const elapsed = await control.evaluate(async element => {
      const start = performance.now()
      element.click()
      while (!document.querySelector('[data-navigation-overlay]')) {
        if (performance.now() - start > 1000) return 1000
        await new Promise(requestAnimationFrame)
      }
      return performance.now() - start
    })
    assert.ok(elapsed < 300, `${label}: feedback took ${elapsed.toFixed(0)} ms`)
    const overlay = page.locator('[data-navigation-overlay]')
    await overlay.getByRole('heading', { name: title, exact: true }).waitFor()
    await page.waitForTimeout(600)
    assert.ok(await overlay.isVisible(), `${label}: stays visible while response is held`)
    results.push({ label, feedbackMs: Math.round(elapsed), responseHeld: true })
    console.log(JSON.stringify(results.at(-1)))
    await page.screenshot({ path: `${output}/${label}.png` })
  }
  const nav = page.getByRole('navigation', { name: 'Primary navigation' })
  await immediate('dashboard', nav.getByRole('button', { name: 'Dashboard', exact: true }), 'Dashboard')
  assert.equal(await nav.getByRole('button', { name: 'Dashboard', exact: true }).getAttribute('aria-current'), 'page')
  release('dashboard')
  await page.locator('[data-v3-dashboard-indicator="root"]').waitFor({ state: 'visible', timeout: 45000 })
  await immediate('progress-tab', page.getByRole('tab', { name: 'My Progress', exact: true }), 'Dashboard')
  assert.equal(await page.locator('[data-navigation-overlay]').getByRole('tab', { name: 'My Progress', exact: true }).getAttribute('aria-selected'), 'true')
  release('profile')
  await page.locator('[data-v3-dashboard-indicator="achievement-collection"]').waitFor({ state: 'visible', timeout: 45000 })
  await nav.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.locator('[data-v3-perf-indicator="projects"]').first().waitFor({ state: 'attached', timeout: 45000 })
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden' })
  const project = page.locator('a[href^="/projects/"]').first()
  // A cancelled navigation must not put the app into a loading state.
  await project.evaluate(element => element.addEventListener('click', event => event.preventDefault(), { once: true }))
  await project.click()
  assert.equal(await page.locator('[data-navigation-overlay]').count(), 0)
  const previousURL = page.url()
  const modifierPrevented = await project.evaluate(element => {
    let preventedByLink = null
    window.addEventListener('click', event => {
      preventedByLink = event.defaultPrevented
      // Observe Next's behavior before suppressing the actual new-tab action
      // in this held-network test (a popup can wait for its first response).
      event.preventDefault()
    }, { once: true })
    element.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }))
    return preventedByLink
  })
  assert.equal(modifierPrevented, false)
  assert.equal(page.url(), previousURL)
  assert.equal(await page.locator('[data-navigation-overlay]').count(), 0)
  await immediate('project-link', project, 'Projects')
  // Navigation remains interruptible, even with the earlier request held.
  await nav.getByRole('button', { name: 'Dashboard', exact: true }).click()
  release('project-detail')
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 45000 })
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 45000 })
  await page.locator('[data-v3-dashboard-indicator="root"]').waitFor({ state: 'visible' })
  assert.deepEqual(errors, [])
  writeFileSync(`${output}/results.json`, JSON.stringify({ baseURL, buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), results, interruptedNavigation: true, cancelledClick: true, modifierClick: true, errors }, null, 2))
} finally {
  await browser?.close()
  server.kill()
}
