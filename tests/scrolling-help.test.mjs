import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { chromium } from 'playwright'

test('installed app can submit from a scrolled, locked page without reaching the header', async () => {
  const bundle = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Help from './app/components/scrolling-help'; createRoot(document.getElementById('root')).render(React.createElement(Help));`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, outdir: 'scrolling-help-test', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'mock-report-server', setup(build) {
      build.onResolve({ filter: /report-bug\/actions$/ }, () => ({ path: 'report-action', namespace: 'test' }))
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export async function submitBugReport(form) { window.reportCalls.push(Object.fromEntries(form)); return window.failReport ? {ok:false} : {ok:true}; }` }))
    } }],
  })
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text
  const browser = await chromium.launch()
  try {
    for (const installed of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 667 }, isMobile: true, hasTouch: true })
      await page.route('https://scroll.test/**', route => route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main inert style="height:3200px">Page content</main><div id="root"></div>` }))
      await page.goto('https://scroll.test/dashboard')
      await page.evaluate(installed => {
        Object.defineProperty(navigator, 'standalone', { value: installed })
        window.reportCalls = []
        window.failReport = true
        window.scrollTo(0, 1200)
        document.documentElement.style.overflow = 'hidden'
      }, installed)
      await page.addScriptTag({ content: js })
      if (!installed) {
        await page.waitForTimeout(100)
        assert.equal(await page.getByRole('button', { name: 'Report scrolling issue' }).count(), 0)
      } else {
        const button = page.getByRole('button', { name: 'Report scrolling issue' })
        await button.waitFor()
        const rect = await button.boundingBox()
        assert.ok(rect.y >= 0 && rect.y + rect.height <= 667 - 69)
        assert.ok(rect.height >= 44)
        await button.tap()
        await page.getByRole('alert').waitFor()
        assert.equal(await page.evaluate(() => scrollY), 1200)
        await page.evaluate(() => { window.failReport = false })
        await page.getByRole('button', { name: 'Retry scroll report' }).tap()
        await page.getByRole('status').waitFor()
        const report = await page.evaluate(() => window.reportCalls.at(-1))
        assert.equal(report.buggedPage, '/dashboard')
        assert.equal(JSON.parse(report.scrollDiagnostics).scrollY, 1200)
        assert.equal(JSON.parse(report.scrollDiagnostics).root.overflow, 'hidden')
        assert.match(await page.getByRole('status').innerText(), /report sent/)
      }
      await page.close()
    }
  } finally { await browser.close() }
})
