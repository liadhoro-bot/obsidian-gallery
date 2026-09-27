import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('painting timer and session history support saving, editing, and recovery', async () => {
  const source = await readFile(new URL('../app/units/[id]/unit-v3-preview.tsx', import.meta.url), 'utf8')
  // Exercise the actual tab with only its network boundary replaced.
  const component = source.slice(source.indexOf('function getLocalDateKey('), source.indexOf('function ProgressTab('))
  const result = await build({
    stdin: { contents: `
      import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
      import { createRoot } from 'react-dom/client';
      const fallbackPaintSessions = [];
      const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      let persisted = null;
      let autoStart = false;
      let logs = [];
      window.starts = 0;
      window.fail = false;
      const useRouter = () => ({ refresh() { render(); }, push() { throw new Error('Starting a timer must not navigate'); } });
      async function startUnitSession(id, startedAt) {
        window.starts++;
        await new Promise(resolve => { window.finishSave = resolve; });
        if (window.fail) throw new Error('Unable to save session');
        persisted = { id: 'saved', started_at: startedAt };
        return persisted;
      }
      async function endUnitSession() { persisted = null; }
      async function updateUnitSession(data) {
        window.editPayload = Object.fromEntries(data);
        await new Promise(resolve => { window.finishEdit = resolve; });
        if (window.failEdit) throw new Error('Unable to update session');
        const seconds = (Date.parse(data.get('endedAt')) - Date.parse(data.get('startedAt'))) / 1000;
        logs = logs.map(session => session.id === data.get('sessionId') ? {
          ...session, startedAt: data.get('startedAt'), dateKey: getLocalDateKey(new Date(data.get('startedAt'))),
          durationSeconds: seconds, duration: Math.floor(seconds / 3600) + 'h ' + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + 'm',
        } : session);
        return { started_at: data.get('startedAt'), duration_seconds: seconds };
      }
      ${component}
      const root = createRoot(document.getElementById('root'));
      let version = 0;
      function render() { root.render(<PaintTab key={version} autoStartSession={autoStart} unit={{ id: 'unit', logged: '0h 00m', paintSessions: logs, activeSession: persisted }} />); }
      window.beginAutoStart = () => { autoStart = true; window.fail = false; version++; render(); };
      window.loadHistory = () => {
        logs = [{ id: 'session-1', startedAt: '2026-09-20T23:30:15.000Z', dateKey: '2026-09-21', title: 'Basecoat', duration: '1h 00m', durationSeconds: 3600, notes: 'Keep these notes' }];
        version++; render();
      };
      window.remount = () => { version++; render(); };
      render();
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
  })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ timezoneId: 'Asia/Jerusalem' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: result.outputFiles[0].text })
    await page.getByRole('button', { name: 'Start Painting', exact: true }).click()
    await page.getByRole('timer').waitFor({ timeout: 1000 })
    assert.equal(await page.getByRole('button', { name: 'Stop Painting', exact: true }).isDisabled(), true)
    await page.waitForFunction(() => document.querySelector('[role="timer"]')?.textContent !== '00:00:00')
    assert.equal(await page.evaluate(() => window.starts), 1)
    await page.evaluate(() => window.finishSave())
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent.includes('Stop Painting'))?.disabled)
    await page.evaluate(() => window.remount())
    await page.getByRole('timer').waitFor()
    assert.notEqual(await page.getByRole('timer').textContent(), '00:00:00')
    await page.getByRole('button', { name: 'Stop Painting', exact: true }).click()
    await page.getByRole('button', { name: 'Start Painting', exact: true }).waitFor()
    assert.equal(await page.getByRole('timer').count(), 0)
    await page.evaluate(() => { window.fail = true })
    await page.getByRole('button', { name: 'Start Painting', exact: true }).click()
    await page.getByRole('timer').waitFor()
    await page.evaluate(() => window.finishSave())
    await page.getByText('Unable to save session').waitFor()
    assert.equal(await page.getByRole('timer').count(), 0)
    await page.evaluate(() => window.loadHistory())
    const historyButton = page.getByRole('button', { name: /History/ })
    const history = page.getByRole('region', { name: 'Painting session history' })
    assert.equal(await history.isVisible(), false)
    assert.equal(await page.getByRole('button', { name: 'Edit session', exact: true }).count(), 0)
    await historyButton.click()
    await history.waitFor()
    assert.equal(await page.evaluate(() => {
      const calendar = document.querySelector('[data-v3-unit-calendar-month]').closest('section')
      return calendar.nextElementSibling.id === 'painting-session-history'
    }), true)
    await history.getByRole('button', { name: 'Edit session' }).click()
    const form = history.getByRole('form', { name: 'Edit painting session' })
    assert.equal(await form.getByLabel('Date', { exact: true }).inputValue(), '2026-09-21')
    assert.equal(await form.getByLabel('Start time').inputValue(), '02:30:15')
    await form.getByLabel('Length (minutes)').fill('99')
    await form.getByRole('button', { name: 'Cancel', exact: true }).click()
    await history.getByRole('button', { name: 'Edit session' }).click()
    assert.equal(await form.getByLabel('Length (minutes)').inputValue(), '60')
    await form.getByLabel('Length (minutes)').fill('0')
    await form.getByRole('button', { name: 'Save session' }).click()
    await form.getByRole('alert').waitFor()
    assert.equal(await page.evaluate(() => window.editPayload), undefined)
    await form.getByLabel('Date', { exact: true }).fill('2026-09-19')
    await form.getByLabel('Start time').fill('23:45:00')
    await form.getByLabel('Length (minutes)').fill('90')
    await form.getByRole('button', { name: 'Save session' }).click()
    await page.waitForFunction(() => !!window.finishEdit)
    assert.equal(await form.getByRole('button', { name: 'Saving…' }).isDisabled(), true)
    const payload = await page.evaluate(() => window.editPayload)
    assert.equal(payload.unitId, 'unit')
    assert.equal(payload.sessionId, 'session-1')
    assert.equal(payload.startedAt, '2026-09-19T20:45:00.000Z')
    assert.equal(payload.endedAt, '2026-09-19T22:15:00.000Z')
    await page.evaluate(() => window.finishEdit())
    await form.waitFor({ state: 'hidden' })
    assert.match(await history.textContent(), /1h 30m/)
    await historyButton.click()
    assert.equal(await history.isVisible(), false)
    assert.equal(await page.getByRole('button', { name: 'Edit session', exact: true }).count(), 0)
    await historyButton.click()
    await page.getByRole('button', { name: 'Edit session', exact: true }).click()
    const calendarForm = page.getByRole('form', { name: 'Edit painting session' })
    await calendarForm.getByLabel('Length (minutes)').fill('45')
    await page.evaluate(() => { window.failEdit = true; window.finishEdit = null })
    await calendarForm.getByRole('button', { name: 'Save session' }).click()
    await page.waitForFunction(() => !!window.finishEdit)
    await page.evaluate(() => window.finishEdit())
    await page.getByRole('alert').waitFor()
    assert.equal(await calendarForm.getByLabel('Length (minutes)').inputValue(), '45')
    await calendarForm.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.evaluate(() => window.remount())
    await historyButton.click()
    assert.match(await history.textContent(), /1h 30m/)
    await page.evaluate(() => window.beginAutoStart())
    await page.getByRole('timer').waitFor({ timeout: 1000 })
    assert.equal(await page.evaluate(() => window.starts), 3)
    await page.evaluate(() => window.finishSave())
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent.includes('Stop Painting'))?.disabled)
    await page.evaluate(() => window.remount())
    await page.getByRole('timer').waitFor()
    assert.equal(await page.evaluate(() => window.starts), 3)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
