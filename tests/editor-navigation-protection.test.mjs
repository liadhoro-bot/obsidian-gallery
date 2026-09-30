import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from 'playwright'

let browser, server, origin
before(async () => {
  const bundle = await build({
    stdin: { contents: `
      import React, { useState, useLayoutEffect } from 'react';
      import { createRoot } from 'react-dom/client';
      import { useEditorChanges, installEditorNavigationProtection, confirmLeaveEditor } from './app/components/navigation-feedback/unsaved-changes';
      function Editor() {
        const [value, setValue] = useState('original');
        const [busy, setBusy] = useState(false);
        const save = useEditorChanges(value, busy);
        useLayoutEffect(installEditorNavigationProtection, []);
        window.change = setValue;
        window.check = confirmLeaveEditor;
        window.save = () => { setBusy(true); return save(() => new Promise(resolve => {
          window.finish = ok => { setBusy(false); resolve(ok); };
        })); };
        return React.createElement('input', { value, onChange: e => setValue(e.target.value) });
      }
      createRoot(document.getElementById('root')).render(React.createElement(Editor));
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife',
  })
  const html = `<div id="root"></div><a href="/elsewhere">Leave</a><a href="#details">Section</a><script>${bundle.outputFiles[0].text}</script>`
  server = createServer((_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
})
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)) })

async function editor() {
  const page = await browser.newPage()
  await page.goto(origin)
  await page.locator('input').waitFor()
  return page
}
async function checkBlocked(page, expected) {
  let prompted = false
  const handler = async dialog => { prompted = true; await dialog.dismiss() }
  page.on('dialog', handler)
  const allowed = await page.evaluate(() => window.check())
  page.off('dialog', handler)
  assert.equal(prompted, expected)
  assert.equal(allowed, !expected)
}

test('clean, dirty, reverted, failed save, successful save and edits during save', async () => {
  const page = await editor()
  await checkBlocked(page, false)
  await page.locator('input').fill('changed')
  await checkBlocked(page, true)
  await page.locator('input').fill('original')
  await checkBlocked(page, false)
  await page.locator('input').fill('submitted')
  await page.evaluate(() => { window.save() })
  await checkBlocked(page, true)
  await page.evaluate(() => window.finish(false))
  await checkBlocked(page, true)
  await page.evaluate(() => { window.save() })
  await page.locator('input').fill('newer edit')
  await page.evaluate(() => window.finish(true))
  await checkBlocked(page, true)
  await page.evaluate(() => { window.save() })
  await page.evaluate(() => window.finish(true))
  await checkBlocked(page, false)
  await page.close()
})

test('cancel link and browser Back/Forward preserves the editor and history', async () => {
  const page = await editor()
  await page.evaluate(() => {
    history.replaceState({ preserved: true }, '', '/first')
    history.pushState({ preserved: true }, '', '/editor')
    window.routeEvents = 0
    window.addEventListener('popstate', () => { window.routeEvents++ })
  })
  await page.locator('input').fill('unsaved')
  page.on('dialog', dialog => dialog.dismiss())
  await page.getByText('Leave', { exact: true }).click()
  assert.equal(new URL(page.url()).pathname, '/editor')
  await page.evaluate(() => history.back())
  await page.waitForFunction(() => location.pathname === '/editor')
  // Let history restoration and its confirmation complete.
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.routeEvents), 0)
  assert.equal(await page.locator('input').inputValue(), 'unsaved')
  assert.equal(await page.evaluate(() => history.state.preserved), true)
  page.removeAllListeners('dialog')
  page.on('dialog', dialog => dialog.accept())
  await page.evaluate(() => history.back())
  await page.waitForFunction(() => location.pathname === '/first' && window.routeEvents === 1)
  page.removeAllListeners('dialog')
  page.on('dialog', dialog => dialog.dismiss())
  await page.evaluate(() => history.forward())
  await page.waitForTimeout(150)
  assert.equal(new URL(page.url()).pathname, '/first')
  assert.equal(await page.evaluate(() => window.routeEvents), 1)
  await page.close()
})

test('refresh warns while dirty and fragment links do not prompt', async () => {
  const page = await editor()
  await page.locator('input').fill('unsaved')
  let prompts = 0
  page.on('dialog', async dialog => { prompts++; await dialog.dismiss() })
  await page.getByText('Section', { exact: true }).click()
  assert.equal(prompts, 0)
  await page.reload({ timeout: 2000 }).catch(() => {})
  assert.equal(prompts, 1)
  assert.equal(await page.locator('input').inputValue(), 'unsaved')
  await page.close()
})

