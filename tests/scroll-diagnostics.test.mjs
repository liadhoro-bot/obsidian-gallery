import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { chromium } from 'playwright'

const source = ts.transpileModule(readFileSync(new URL('../utils/scroll-diagnostics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

test('scroll report captures blocked layout and deployment without page content or credentials', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.route('https://scroll.test/**', route => route.fulfill({
      contentType: 'text/html', body: '<html><head><link rel="stylesheet" href="data:text/css,body{}?dpl=test-release"></head><body style="overflow:hidden"><main style="height:2400px">private-page-text<input value="private-form-value"></main><div inert>private-overlay-text</div></body></html>',
    }))
    await page.goto('https://scroll.test/dashboard?token=private-token')
    await page.evaluate(source => {
      const api = {}
      new Function('exports', source)(api)
      window.scrollDiagnostics = api
    }, source)
    const result = await page.evaluate(() => window.scrollDiagnostics.captureScrollDiagnostics())
    const report = JSON.parse(result)
    assert.equal(report.path, '/dashboard')
    assert.equal(report.origin, 'https://scroll.test')
    assert.equal(report.body.overflow, 'hidden')
    assert.ok(report.body.scrollHeight > 844)
    assert.equal(report.overlays[0].inert, true)
    assert.deepEqual(report.deployment, ['test-release'])
    assert.doesNotMatch(result, /private-/)
    assert.equal(await page.evaluate(() => window.scrollDiagnostics.readScrollDiagnostics()), result)
    await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('obsidian-scroll-diagnostics'))
      saved.capturedAt = '2000-01-01T00:00:00Z'
      sessionStorage.setItem('obsidian-scroll-diagnostics', JSON.stringify(saved))
    })
    assert.equal(await page.evaluate(() => window.scrollDiagnostics.readScrollDiagnostics()), '')
    await page.evaluate(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked') } }))
    assert.ok(await page.evaluate(() => window.scrollDiagnostics.captureScrollDiagnostics()))
    assert.equal(await page.evaluate(() => window.scrollDiagnostics.readScrollDiagnostics()), '')
  } finally { await browser.close() }
})
