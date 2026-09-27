import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const baseURL = 'http://127.0.0.1:3127'
const output = '.perf/dashboard-return'
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3127'], { stdio: 'ignore', windowsHide: true })
let browser
let page
let release = () => {}
try {
  for (let attempt = 0; ; attempt++) {
    try { await fetch(`${baseURL}/login`); break } catch {
      if (attempt > 60) throw new Error('Local server did not start')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL, viewport: { width: 430, height: 932 }, serviceWorkers: 'block', storageState: process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-flows.json' })
  await context.addCookies([{ name: 'obsidian_v3_preview', value: '1', url: baseURL }])
  page = await context.newPage()
  const errors = []
  const failedRequests = []
  const imageResponses = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }))
  page.on('response', response => {
    const responseUrl = new URL(response.url())
    if (responseUrl.pathname === '/_next/image' && responseUrl.searchParams.get('url')?.includes('achievement_seals')) {
      imageResponses.push({ url: response.url(), status: response.status() })
    }
  })
  let gate = null
  let heldRequests = 0
  await page.route('**/*', async route => {
    if (gate && route.request().headers().rsc === '1' && new URL(route.request().url()).pathname === '/dashboard') {
      heldRequests++
      await gate
    }
    await route.continue().catch(() => {})
  })
  await page.goto('/dashboard?preview=1', { waitUntil: 'domcontentloaded' })
  const root = page.locator('[data-v3-dashboard-indicator="root"]')
  await root.waitFor({ state: 'visible', timeout: 60000 })
  const originalText = await root.innerText()
  const originalUnits = await root.locator('a[href^="/units/"]').evaluateAll(links => links.map(link => link.getAttribute('href')))
  const nav = page.getByRole('navigation', { name: 'Primary navigation' })
  await nav.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.waitForURL(/\/projects/)
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 45000 })
  gate = new Promise(resolve => { release = resolve })
  const feedbackMs = await nav.getByRole('button', { name: 'Dashboard', exact: true }).evaluate(async button => {
    const start = performance.now()
    button.click()
    while (!document.querySelector('[data-dashboard-return-content]')) {
      if (performance.now() - start > 1000) return 1000
      await new Promise(requestAnimationFrame)
    }
    return performance.now() - start
  })
  assert.ok(feedbackMs < 300, `Real content appeared after ${feedbackMs} ms`)
  console.log(`Cached content visible after ${Math.round(feedbackMs)} ms`)
  const cached = page.locator('[data-navigation-overlay] [data-dashboard-return-content]')
  await cached.waitFor()
  assert.equal(await cached.locator('[data-v3-dashboard-indicator="root"]').innerText(), originalText)
  assert.deepEqual(await cached.locator('a[href^="/units/"]').evaluateAll(links => links.map(link => link.getAttribute('href'))), originalUnits)
  await page.waitForTimeout(2000)
  assert.ok(await cached.isVisible(), 'real content remains visible while the server is held')
  assert.ok(heldRequests > 0, 'server refresh is running behind cached content')
  assert.equal(await cached.locator('[data-navigation-loading]').count(), 0)
  await page.screenshot({ path: `${output}/held-return.png` })
  gate = null
  release()
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 60000 })
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 60000 })
  // Next can commit the URL/loading boundary before the server page finishes;
  // that boundary must keep showing the same cached content as the overlay.
  await page.locator('[data-dashboard-return-content]').waitFor({ state: 'hidden', timeout: 60000 })
  await root.waitFor({ state: 'visible', timeout: 60000 })
  assert.equal(await page.locator('[data-dashboard-return-content]').count(), 0, 'fresh route replaces snapshot')
  await nav.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.waitForURL(/\/projects/)
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 45000 })
  gate = new Promise(resolve => { release = resolve })
  await nav.getByRole('button', { name: 'Dashboard', exact: true }).click()
  // Next may itself reuse the freshly visited route on this second return.
  // Either path must keep the real page usable, including tab navigation.
  await page.locator('[data-v3-dashboard-indicator="root"]:visible').waitFor()
  await page.getByRole('tab', { name: 'My Progress', exact: true }).click()
  gate = null
  release()
  await page.waitForURL(/\/dashboard\?.*tab=profile/, { timeout: 60000 })
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 60000 })
  await page.locator('[data-v3-dashboard-indicator="achievement-collection"]').waitFor({ state: 'visible', timeout: 60000 })
  const sealImages = page.locator('[data-v3-dashboard-indicator="achievement-collection"] img[data-size]')
  if (await sealImages.count()) {
    await sealImages.first().evaluate(image => image.complete && image.naturalWidth > 0
      ? true
      : new Promise((resolve, reject) => {
          image.addEventListener('load', () => resolve(true), { once: true })
          image.addEventListener('error', () => reject(new Error(`Seal image failed: ${image.currentSrc}`)), { once: true })
        }))
  }
  const progressText = await page.locator('[data-v3-dashboard-indicator="root"]').innerText()
  await nav.getByRole('button', { name: 'Projects', exact: true }).click()
  await page.waitForURL(/\/projects/)
  await page.locator('[data-navigation-overlay]').waitFor({ state: 'hidden', timeout: 45000 })
  gate = new Promise(resolve => { release = resolve })
  const progressStartedAt = Date.now()
  const backNavigation = page.goBack({ waitUntil: 'commit' })
  const visibleProgress = page.locator('[data-v3-dashboard-indicator="achievement-collection"]:visible')
  await visibleProgress.waitFor({ state: 'visible', timeout: 1000 })
  const progressFeedbackMs = Date.now() - progressStartedAt
  assert.ok(progressFeedbackMs < 300, `Real Progress appeared after ${progressFeedbackMs} ms`)
  assert.equal(await page.locator('[data-v3-dashboard-indicator="root"]:visible').innerText(), progressText)
  await page.waitForTimeout(2000)
  assert.ok(await visibleProgress.isVisible(), 'real Progress remains visible while the server is held')
  gate = null
  release()
  await backNavigation
  await page.locator('[data-dashboard-return-content]').waitFor({ state: 'hidden', timeout: 60000 })
  await page.locator('[data-v3-dashboard-indicator="achievement-collection"]').waitFor({ state: 'visible', timeout: 60000 })
  assert.deepEqual(errors, [])
  assert.deepEqual(failedRequests.filter(request => request.url.includes('/_next/image')), [])
  assert.ok(imageResponses.every(response => (response.status >= 200 && response.status < 300) || response.status === 304), 'optimized seal image responses succeed or reuse validated cache entries')
  const result = { baseURL, buildId: readFileSync('.next/BUILD_ID', 'utf8').trim(), feedbackMs: Math.round(feedbackMs), progressFeedbackMs, heldRequests, heldForMs: 2000, realContentMatches: true, progressContentMatches: true, freshRouteReplacesSnapshot: true, returnTabNavigation: true, optimizedSealResponses: imageResponses.length, optimizedSealStatuses: [...new Set(imageResponses.map(response => response.status))], errors }
  writeFileSync(`${output}/results.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {})
    writeFileSync(`${output}/failure.txt`, `${page.url()}\n${await page.locator('body').innerText().catch(() => '')}`)
  }
  throw error
} finally { release(); await browser?.close(); server.kill() }
