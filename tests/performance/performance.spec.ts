import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page, test } from '@playwright/test'

const ROUTES = [
  { path: '/', requiresAuth: true },
  { path: '/login', requiresAuth: false },
  { path: '/offline', requiresAuth: false },
  { path: '/support', requiresAuth: false },
  { path: '/settings/terms', requiresAuth: false },
  { path: '/dashboard', requiresAuth: true },
  { path: '/projects', requiresAuth: true },
  { path: '/recipes', requiresAuth: true },
  { path: '/themes', requiresAuth: true },
  { path: '/vault', requiresAuth: true },
  { path: '/units', requiresAuth: true },
] as const

const BUDGETS = {
  lcpMs: 2500,
  cls: 0.1,
  responseMs: 500,
  redirectResponseMs: 1500,
  controlReadyMs: 1000,
  interactionMs: 200,
  routeSettledMs: 1500,
  longTaskMs: 200,
}

type PerfMetrics = {
  lcp: number
  cls: number
  longestTask: number
  longTaskCount: number
  transferSize: number
  encodedBodySize: number
  domContentLoaded: number
  loadEvent: number
}

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    const state = {
      lcp: 0,
      cls: 0,
      longestTask: 0,
      longTaskCount: 0,
    }

    Object.defineProperty(window, '__perfState', {
      value: state,
      configurable: false,
    })

    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1]
          if (lastEntry) {
            const candidate = lastEntry as PerformanceEntry & {
              renderTime?: number
              loadTime?: number
            }
            state.lcp = candidate.renderTime || candidate.loadTime || candidate.startTime
          }
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
            if (!shift.hadRecentInput) {
              state.cls += shift.value || 0
            }
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
    }
  })
}

async function readPerfMetrics(page: Page): Promise<PerfMetrics> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const state = (window as typeof window & {
      __perfState?: {
        lcp: number
        cls: number
        longestTask: number
        longTaskCount: number
      }
    }).__perfState ?? {
      lcp: 0,
      cls: 0,
      longestTask: 0,
      longTaskCount: 0,
    }

    return {
      lcp: Math.round(state.lcp),
      cls: Number(state.cls.toFixed(3)),
      longestTask: Math.round(state.longestTask),
      longTaskCount: state.longTaskCount,
      transferSize: nav?.transferSize ?? 0,
      encodedBodySize: nav?.encodedBodySize ?? 0,
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      loadEvent: Math.round(nav?.loadEventEnd ?? 0),
    }
  })
}

async function gotoMeasured(page: Page, route: string) {
  const started = performance.now()
  const response = await page.goto(route, { waitUntil: 'commit' })
  const responseMs = Math.round(performance.now() - started)
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(250)

  const interactiveStarted = performance.now()
  await page.locator('body').waitFor({ state: 'visible' })
  const firstControl = page.locator('button, input, select, textarea, a[href]').first()
  if ((await firstControl.count()) > 0) {
    await firstControl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }
  const controlReadyMs = Math.round(performance.now() - interactiveStarted)
  const metrics = await readPerfMetrics(page)

  return {
    status: response?.status() ?? 0,
    redirected: Boolean(response?.request().redirectedFrom()),
    responseMs,
    controlReadyMs,
    metrics,
  }
}

async function expectInteractionWithinBudget(
  label: string,
  action: () => Promise<void>,
  budgetMs = BUDGETS.interactionMs
) {
  const started = performance.now()
  await action()
  const elapsed = Math.round(performance.now() - started)
  expect(elapsed, `${label} took ${elapsed}ms`).toBeLessThanOrEqual(budgetMs)
  return elapsed
}

const defaultStorageStatePath = resolve('.perf/perf-storage-state-flows.json')
const hasPerfStorageState = Boolean(
  (process.env.PERF_STORAGE_STATE && existsSync(process.env.PERF_STORAGE_STATE)) ||
    existsSync(defaultStorageStatePath)
)

async function isLoginSurface(page: Page) {
  if (new URL(page.url()).pathname === '/login') return true

  const signInHeading = page.getByRole('heading', { name: 'Sign in' })
  return signInHeading.isVisible().catch(() => false)
}

async function expectMeasuredRouteWithinBudget(
  page: Page,
  route: string,
  testInfo: { annotations: Array<{ type: string; description: string }> }
) {
  const result = await gotoMeasured(page, route)

  testInfo.annotations.push({
    type: 'perf',
    description: JSON.stringify({ route, ...result }),
  })

  expect([200, 307, 308], `${route} status`).toContain(result.status)
  const responseBudget =
    result.redirected || result.status === 307 || result.status === 308
      ? BUDGETS.redirectResponseMs
      : BUDGETS.responseMs
  expect(result.responseMs, `${route} response time`).toBeLessThanOrEqual(
    responseBudget
  )
  expect(result.controlReadyMs, `${route} control readiness`).toBeLessThanOrEqual(
    BUDGETS.controlReadyMs
  )
  expect(result.metrics.lcp, `${route} LCP`).toBeLessThanOrEqual(BUDGETS.lcpMs)
  expect(result.metrics.cls, `${route} CLS`).toBeLessThanOrEqual(BUDGETS.cls)
  expect(
    result.metrics.longestTask,
    `${route} longest JS task`
  ).toBeLessThanOrEqual(BUDGETS.longTaskMs)
}

async function resolveProtectedDetailRoutes(page: Page) {
  await gotoMeasured(page, '/projects')
  if (await isLoginSurface(page)) {
    return {
      projectRoute: null,
      unitRoute: null,
    }
  }

  const projectRoute = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
    const match = links
      .map((link) => link.getAttribute('href'))
      .find((href) => typeof href === 'string' && /^\/projects\/[^/?#]+$/.test(href))

    return match ?? null
  })

  if (!projectRoute) {
    return {
      projectRoute: null,
      unitRoute: null,
    }
  }

  await gotoMeasured(page, projectRoute)
  if (await isLoginSurface(page)) {
    return {
      projectRoute,
      unitRoute: null,
    }
  }

  const unitRoute = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
    const match = links
      .map((link) => link.getAttribute('href'))
      .find((href) => typeof href === 'string' && /^\/units\/[^/?#]+$/.test(href))

    return match ?? null
  })

  return {
    projectRoute,
    unitRoute,
  }
}

test.beforeEach(async ({ page }) => {
  await installPerfObservers(page)
})

test.describe('route performance budgets', () => {
  for (const route of ROUTES) {
    test(`${route.path} meets page-level budgets`, async ({ page }, testInfo) => {
      test.skip(
        route.requiresAuth && !hasPerfStorageState,
        `${route.path} needs PERF_STORAGE_STATE for a real authenticated benchmark.`
      )

      const result = await gotoMeasured(page, route.path)
      test.skip(
        route.requiresAuth && (await isLoginSurface(page)),
        `${route.path} resolved to login; configure PERF_STORAGE_STATE.`
      )

      testInfo.annotations.push({
        type: 'perf',
        description: JSON.stringify({ route: route.path, ...result }),
      })

      expect([200, 307, 308], `${route.path} status`).toContain(result.status)
      const responseBudget =
        result.redirected || result.status === 307 || result.status === 308
          ? BUDGETS.redirectResponseMs
          : BUDGETS.responseMs
      expect(result.responseMs, `${route.path} response time`).toBeLessThanOrEqual(
        responseBudget
      )
      expect(
        result.controlReadyMs,
        `${route.path} control readiness`
      ).toBeLessThanOrEqual(BUDGETS.controlReadyMs)
      expect(result.metrics.lcp, `${route.path} LCP`).toBeLessThanOrEqual(BUDGETS.lcpMs)
      expect(result.metrics.cls, `${route.path} CLS`).toBeLessThanOrEqual(BUDGETS.cls)
      expect(
        result.metrics.longestTask,
        `${route.path} longest JS task`
      ).toBeLessThanOrEqual(BUDGETS.longTaskMs)
    })
  }
})

test('project detail route meets page-level budgets', async ({ page }, testInfo) => {
  test.skip(
    !hasPerfStorageState,
    'Project detail benchmark needs an authenticated Playwright storage state.'
  )

  const { projectRoute } = await resolveProtectedDetailRoutes(page)
  test.skip(!projectRoute, 'No project detail route available for performance measurement.')
  test.skip(await isLoginSurface(page), 'Project detail resolved to login; configure PERF_STORAGE_STATE.')

  await expectMeasuredRouteWithinBudget(page, projectRoute!, testInfo)
})

test('unit detail route meets page-level budgets', async ({ page }, testInfo) => {
  test.skip(
    !hasPerfStorageState,
    'Unit detail benchmark needs an authenticated Playwright storage state.'
  )

  const { unitRoute } = await resolveProtectedDetailRoutes(page)
  test.skip(!unitRoute, 'No unit detail route available for performance measurement.')
  test.skip(await isLoginSurface(page), 'Unit detail resolved to login; configure PERF_STORAGE_STATE.')

  await expectMeasuredRouteWithinBudget(page, unitRoute!, testInfo)
})

test('vault search interaction stays responsive', async ({ page }, testInfo) => {
  test.skip(
    !hasPerfStorageState,
    'Vault interaction benchmark needs an authenticated Playwright storage state.'
  )
  await gotoMeasured(page, '/vault')
  test.skip(await isLoginSurface(page), 'Vault resolved to login; configure PERF_STORAGE_STATE.')

  const search = page.getByPlaceholder('Search by name, brand, line, or barcode')
  await expect(search).toBeVisible()

  const inputMs = await expectInteractionWithinBudget('vault search input', () =>
    search.fill('red')
  )

  const settledStarted = performance.now()
  await expect(search).toHaveValue('red')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'), {
      timeout: 3_000,
    })
    .toBe('red')
  const settledMs = Math.round(performance.now() - settledStarted)

  testInfo.annotations.push({
    type: 'perf',
    description: JSON.stringify({ flow: 'vault-search', inputMs, settledMs }),
  })

  expect(settledMs, `vault search settled in ${settledMs}ms`).toBeLessThanOrEqual(
    BUDGETS.routeSettledMs
  )
})

test('recipes tabs and search stay responsive', async ({ page }, testInfo) => {
  test.skip(
    !hasPerfStorageState,
    'Recipes interaction benchmark needs an authenticated Playwright storage state.'
  )
  await gotoMeasured(page, '/recipes')
  test.skip(
    await isLoginSurface(page),
    'Recipes resolved to login; configure PERF_STORAGE_STATE.'
  )

  const findRecipeTab = page
    .getByRole('button', { name: 'Find Recipe' })
    .or(page.getByRole('link', { name: 'Find Recipe' }))
  const createRecipeTab = page
    .getByRole('button', { name: 'Create Recipe' })
    .or(page.getByRole('link', { name: 'Create Recipe' }))

  const tabMs = await expectInteractionWithinBudget('recipe tab switch', () =>
    createRecipeTab.click()
  )
  await expect
    .poll(() => new URL(page.url()).searchParams.get('tab') ?? 'find')
    .toBe('custom')
  await expect(page.getByPlaceholder('e.g. Shadow Knight Armor')).toBeVisible()

  const findTabMs = await expectInteractionWithinBudget('recipe find tab switch', () =>
    findRecipeTab.click()
  )
  await expect
    .poll(() => new URL(page.url()).searchParams.get('tab') ?? 'find')
    .toBe('find')

  const search = page.getByPlaceholder('Search recipes by name...')
  await expect(search).toBeVisible()
  const searchMs = await expectInteractionWithinBudget('recipe search input', () =>
    search.fill('red')
  )

  testInfo.annotations.push({
    type: 'perf',
    description: JSON.stringify({
      flow: 'recipes-tabs-search',
      tabMs,
      findTabMs,
      searchMs,
    }),
  })
})
