import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { chromium } from 'playwright'

test('shared submit controls show immediate pending feedback and recover after success or failure', async () => {
  const compiled = await build({
    stdin: { contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { OgButton } from './src/components/v3/controls/button';
      import SubmitButton from './app/components/SubmitButton';
      function Fixture() {
        const [message, setMessage] = useState('');
        async function save() {
          setMessage('');
          try { await new Promise((resolve, reject) => { window.finishSave = ok => ok ? resolve() : reject(new Error('Save failed')); }); setMessage('Saved'); }
          catch { setMessage('Save failed. Try again.'); }
        }
        return <><form action={save}><OgButton type="submit" data-testid="save">Save</OgButton></form>
          <form action={save}><SubmitButton idleText="Create" pendingText="Creating…" /></form>
          <p data-testid="result">{message}</p></>;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.module.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
  })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: compiled.outputFiles[0].text })
    const save = page.getByTestId('save')
    for (const success of [true, false]) {
      await save.click()
      assert.equal(await save.getAttribute('aria-busy'), 'true')
      assert.ok(await save.isDisabled())
      assert.ok(await page.getByRole('status').isVisible())
      await page.evaluate(ok => window.finishSave(ok), success)
      await page.getByTestId('result').filter({ hasText: success ? /^Saved$/ : /Save failed/ }).waitFor()
      assert.ok(await save.isEnabled())
      assert.equal(await save.getAttribute('aria-busy'), null)
    }
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    const creating = page.getByRole('button', { name: 'Creating…', exact: true })
    assert.ok(await creating.isDisabled())
    assert.equal(await creating.getAttribute('aria-busy'), 'true')
    await page.evaluate(() => window.finishSave(true))
    await page.getByRole('button', { name: 'Create', exact: true }).waitFor()
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
