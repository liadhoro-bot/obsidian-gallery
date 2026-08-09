import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test, type TestInfo } from '@playwright/test'

type V3MetricResult = {
  cls: number
  controlReadyMs: number
  domContentLoaded: number
  encodedBodySize: number
  lcp: number
  loadEvent: number
  longTaskCount: number
  longestTask: number
  responseMs: number
  status: number
  transferSize: number
}

const defaultStorageStatePath = resolve('.perf/perf-storage-state-flows.json')
const hasPerfStorageState = Boolean(
  (process.env.PERF_STORAGE_STATE && existsSync(process.env.PERF_STORAGE_STATE)) ||
    existsSync(defaultStorageStatePath)
)

const BUDGETS = {
  cls: Number(process.env.V3_PERF_MAX_CLS ?? 0.1),
  controlReadyMs: Number(process.env.V3_PERF_MAX_CONTROL_READY_MS ?? 1400),
  coldResponseMs: Number(process.env.V3_PERF_MAX_COLD_RESPONSE_MS ?? 10_000),
  interactionMs: Number(process.env.V3_PERF_MAX_INTERACTION_MS ?? 350),
  lcpMs: Number(process.env.V3_PERF_MAX_LCP_MS ?? 3200),
  longTaskMs: Number(process.env.V3_PERF_MAX_LONG_TASK_MS ?? 350),
  responseMs: Number(process.env.V3_PERF_MAX_RESPONSE_MS ?? 2200),
}

const allowColdServer = process.env.V3_PERF_ALLOW_COLD_SERVER === '1'

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    const state = {
      cls: 0,
      lcp: 0,
      longTaskCount: 0,
      longestTask: 0,
    }

    Object.defineProperty(window, '__v3PerfState', {
      configurable: false,
      value: state,
    })

    if (!('PerformanceObserver' in window)) return

    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (!lastEntry) return

        const candidate = lastEntry as PerformanceEntry & {
          loadTime?: number
          renderTime?: number
        }
        state.lcp = candidate.renderTime || candidate.loadTime || candidate.startTime
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {}

    try {
      const clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean
            value?: number
          }
          if (!shift.hadRecentInput) state.cls += shift.value || 0
        }
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch {}

    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          state.longTaskCount += 1
          state.longestTask = Math.max(state.longestTask, entry.duration)
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {}
  })
}

async function readMetrics(page: Page): Promise<
  Pick<
    V3MetricResult,
    | 'cls'
    | 'domContentLoaded'
    | 'encodedBodySize'
    | 'lcp'
    | 'loadEvent'
    | 'longTaskCount'
    | 'longestTask'
    | 'transferSize'
  >
> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const state = (window as typeof window & {
      __v3PerfState?: {
        cls: number
        lcp: number
        longTaskCount: number
        longestTask: number
      }
    }).__v3PerfState ?? {
      cls: 0,
      lcp: 0,
      longTaskCount: 0,
      longestTask: 0,
    }

    return {
      cls: Number(state.cls.toFixed(3)),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      encodedBodySize: nav?.encodedBodySize ?? 0,
      lcp: Math.round(state.lcp),
      loadEvent: Math.round(nav?.loadEventEnd ?? 0),
      longTaskCount: state.longTaskCount,
      longestTask: Math.round(state.longestTask),
      transferSize: nav?.transferSize ?? 0,
    }
  })
}

async function waitForV3Indicator(
  page: Page,
  surface: string,
  detail?: string
) {
  const selector = [
    `[data-v3-perf-indicator="${surface}"]`,
    detail ? `[data-v3-perf-detail="${detail}"]` : '',
  ].join('')
  const indicator = page.locator(selector).first()

  await expect(indicator, `${surface}${detail ? `:${detail}` : ''} indicator`).toHaveCount(1)
  const markName = await indicator.getAttribute('data-v3-perf-mark')
  expect(markName, `${surface} perf mark name`).toBeTruthy()

  await expect
    .poll(
      () =>
        page.evaluate(
          (name) => performance.getEntriesByName(name).length,
          markName as string
        ),
      { message: `${markName} performance mark` }
    )
    .toBeGreaterThan(0)
}

async function gotoMeasured(
  page: Page,
  route: string,
  surface: string,
  detail: string | undefined,
  testInfo: TestInfo
): Promise<V3MetricResult> {
  const started = performance.now()
  const response = await page.goto(route, { waitUntil: 'commit' })
  const responseMs = Math.round(performance.now() - started)

  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
  await waitForV3Indicator(page, surface, detail)
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(150)

  const controlReadyStarted = performance.now()
  const firstControl = page.locator('button, input, select, textarea, a[href]').first()
  if ((await firstControl.count()) > 0) {
    await firstControl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }
  const controlReadyMs = Math.round(performance.now() - controlReadyStarted)
  const metrics = await readMetrics(page)
  const result = {
    ...metrics,
    controlReadyMs,
    responseMs,
    status: response?.status() ?? 0,
  }

  testInfo.annotations.push({
    description: JSON.stringify({ detail, route, surface, ...result }),
    type: 'v3-perf',
  })

  expect([200, 307, 308], `${route} status`).toContain(result.status)
  expect(result.responseMs, `${route} response time`).toBeLessThanOrEqual(
    allowColdServer ? BUDGETS.coldResponseMs : BUDGETS.responseMs
  )
  expect(result.controlReadyMs, `${route} control ready`).toBeLessThanOrEqual(
    BUDGETS.controlReadyMs
  )
  expect(result.lcp, `${route} LCP`).toBeLessThanOrEqual(BUDGETS.lcpMs)
  expect(result.cls, `${route} CLS`).toBeLessThanOrEqual(BUDGETS.cls)
  expect(result.longestTask, `${route} longest task`).toBeLessThanOrEqual(
    BUDGETS.longTaskMs
  )

  return result
}

async function clickMeasured(
  label: string,
  action: () => Promise<void>,
  testInfo: TestInfo
) {
  const started = performance.now()
  await action()
  const elapsed = Math.round(performance.now() - started)

  testInfo.annotations.push({
    description: JSON.stringify({ elapsed, label }),
    type: 'v3-interaction',
  })
  expect(elapsed, `${label} interaction`).toBeLessThanOrEqual(
    BUDGETS.interactionMs
  )
}

async function switchTab(
  page: Page,
  label: RegExp,
  surface: string,
  detail: string,
  testInfo: TestInfo
) {
  await clickMeasured(
    `${surface}:${detail}`,
    () => page.getByRole('tab', { name: label }).click(),
    testInfo
  )
  await waitForV3Indicator(page, surface, detail)
}

async function firstHref(page: Page, selector: string) {
  return page.locator(selector).first().getAttribute('href')
}

test.describe('V3 Perf Test', () => {
  test.beforeEach(async ({ page }) => {
    await installPerfObservers(page)
  })

  test('login and onboarding screens expose fast V3 readiness marks', async ({
    page,
  }, testInfo) => {
    await gotoMeasured(page, '/login?preview=1', 'login', 'preview', testInfo)

    await clickMeasured(
      'login:start here opens sign-in card',
      () => page.getByRole('button', { name: /start here/i }).click(),
      testInfo
    )
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

    await gotoMeasured(
      page,
      '/onboarding?preview=1&reset=v3-perf',
      'onboarding',
      'terms',
      testInfo
    )
    await page.getByRole('checkbox').first().check()
    await clickMeasured(
      'onboarding:terms accept',
      () => page.getByRole('button', { name: /accept and continue/i }).click(),
      testInfo
    )
    await waitForV3Indicator(page, 'onboarding', 'persona')

    await clickMeasured(
      'onboarding:persona select',
      () =>
        page
          .getByRole('button', { name: /help me paint a miniature/i })
          .click(),
      testInfo
    )
    await clickMeasured(
      'onboarding:persona continue',
      () => page.getByRole('button', { name: /start my first miniature/i }).click(),
      testInfo
    )
    await waitForV3Indicator(page, 'onboarding', 'creation')

    await clickMeasured(
      'onboarding:creation skip',
      () => page.getByRole('button', { name: /i'll add one later/i }).click(),
      testInfo
    )
    await waitForV3Indicator(page, 'onboarding', 'curator')

    await clickMeasured(
      'onboarding:enter gallery',
      () => page.getByRole('button', { name: /enter the gallery/i }).click(),
      testInfo
    )
    await waitForV3Indicator(page, 'dashboard', 'active-units')
  })

  test('five V3 nav pages and their tabs stay responsive', async ({
    page,
  }, testInfo) => {
    test.skip(!hasPerfStorageState, 'V3 app pages need the perf auth storage state.')

    await gotoMeasured(
      page,
      '/dashboard?preview=1',
      'dashboard',
      'active-units',
      testInfo
    )
    await switchTab(page, /my progress/i, 'dashboard', 'my-progress', testInfo)
    await switchTab(page, /active units/i, 'dashboard', 'active-units', testInfo)

    await gotoMeasured(page, '/projects?preview=1', 'projects', 'projects', testInfo)
    await switchTab(page, /units/i, 'projects', 'units', testInfo)
    await switchTab(page, /projects/i, 'projects', 'projects', testInfo)

    await gotoMeasured(page, '/paints?preview=1', 'paints', 'owned', testInfo)
    await switchTab(page, /paint library/i, 'paints', 'library', testInfo)
    await switchTab(page, /my paints/i, 'paints', 'owned', testInfo)

    await gotoMeasured(page, '/guides?preview=1', 'guides', 'guides', testInfo)
    await switchTab(page, /decks/i, 'guides', 'decks', testInfo)
    await switchTab(page, /library/i, 'guides', 'library', testInfo)
    await switchTab(page, /^guides$/i, 'guides', 'guides', testInfo)

    await gotoMeasured(page, '/community?preview=1', 'community', 'feed', testInfo)
    await switchTab(page, /contests/i, 'community', 'contests', testInfo)
    await switchTab(page, /news/i, 'community', 'news', testInfo)
    await switchTab(page, /events/i, 'community', 'events', testInfo)
  })

  test('settings and V3 subpages expose perf marks without route errors', async ({
    page,
  }, testInfo) => {
    test.skip(!hasPerfStorageState, 'V3 subpages need the perf auth storage state.')

    await gotoMeasured(page, '/settings?preview=1', 'settings', 'main', testInfo)

    await gotoMeasured(page, '/projects?preview=1', 'projects', 'projects', testInfo)
    const projectHref = await firstHref(
      page,
      'a[href^="/projects/"][href*="preview=1"]'
    )
    expect(projectHref, 'first project detail href').toBeTruthy()
    await gotoMeasured(
      page,
      projectHref as string,
      'project-detail',
      'units',
      testInfo
    )
    await switchTab(page, /project details/i, 'project-detail', 'details', testInfo)

    await gotoMeasured(page, '/projects?preview=1', 'projects', 'units', testInfo)
    await switchTab(page, /units/i, 'projects', 'units', testInfo)
    const unitHref = await firstHref(page, 'a[href^="/units/"][href*="preview=1"]')
    expect(unitHref, 'first unit detail href').toBeTruthy()
    await gotoMeasured(page, unitHref as string, 'unit', 'details', testInfo)
    await switchTab(page, /paint/i, 'unit', 'paint', testInfo)
    await switchTab(page, /progress/i, 'unit', 'progress', testInfo)

    await gotoMeasured(page, '/guides?preview=1', 'guides', 'guides', testInfo)
    const guideHref = await firstHref(
      page,
      'a[href^="/guides/"][href*="preview=1"]:not([href^="/guides/decks/"])'
    )
    expect(guideHref, 'first guide detail href').toBeTruthy()
    await gotoMeasured(page, guideHref as string, 'guide-detail', 'main', testInfo)

    await gotoMeasured(page, '/guides?preview=1', 'guides', 'guides', testInfo)
    await switchTab(page, /decks/i, 'guides', 'decks', testInfo)
    const deckHref = await firstHref(
      page,
      'a[href^="/guides/decks/"][href*="preview=1"]'
    )
    expect(deckHref, 'first deck detail href').toBeTruthy()
    await gotoMeasured(page, deckHref as string, 'deck-detail', 'main', testInfo)
  })
})
