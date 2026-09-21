import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { chromium } from 'playwright'

// Exercise the real root CSS without authentication, network, or app data.
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
  .replace(/^@import .*;$/gm, '')

for (const mode of ['browser', 'standalone', 'fullscreen']) {
  test(`${mode}: vertical gestures reach the document in both directions`, async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      })
      const session = await page.context().newCDPSession(page)
      // CDP cannot emulate installed display-mode. Activate only that media
      // condition in the fixture; this tests CSS and gestures, not an OS PWA.
      const modeCss = css.replaceAll('(display-mode: standalone)', mode === 'standalone' ? '(min-width: 0px)' : '(min-width: 99999px)')
        .replaceAll('(display-mode: fullscreen)', mode === 'fullscreen' ? '(min-width: 0px)' : '(min-width: 99999px)')
      await page.setContent(`<!doctype html><html><head><style>${modeCss}</style></head>
        <body style="display:flex;flex-direction:column">
        <main style="min-height:3200px;flex-shrink:0">Scrollable content</main>
        </body></html>`)
      if (mode !== 'browser') {
        assert.deepEqual(await page.evaluate(() => ({
          overflow: getComputedStyle(document.body).overflowY,
          chaining: getComputedStyle(document.body).overscrollBehaviorY,
        })), { overflow: 'visible', chaining: 'auto' })
      }
      const swipe = async (from, to) => {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart', touchPoints: [{ x: 195, y: from }],
        })
        for (let step = 1; step <= 12; step++) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: 195, y: from + (to - from) * step / 12 }],
          })
          await page.waitForTimeout(25)
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await page.waitForTimeout(500)
      }
      await swipe(650, 200)
      const down = await page.evaluate(() => window.scrollY)
      assert.ok(down > 100, `Expected downward page scrolling, got ${down}`)
      await swipe(200, 650)
      assert.ok(await page.evaluate(() => window.scrollY) < down, 'Expected upward page scrolling')
    } finally {
      await browser.close()
    }
  })
}
