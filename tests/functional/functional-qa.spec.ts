import { expect, type Page, test } from '@playwright/test'

const PUBLIC_ROUTES = [
  { path: '/login', heading: 'Sign in' },
  { path: '/offline', heading: /offline/i },
  { path: '/support', heading: 'Keep the workshop running' },
  { path: '/settings/terms', heading: 'Terms & Conditions' },
] as const

const PROTECTED_ROUTES = [
  { path: '/dashboard', heading: /dashboard|welcome/i },
  { path: '/projects', heading: 'Projects' },
  { path: '/recipes', heading: 'The Guide Library' },
  { path: '/themes', heading: 'Theme Library' },
  { path: '/vault', heading: 'Paints' },
] as const

function registerPageFailureGuards(page: Page) {
  const errors: string[] = []

  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() !== 'error') return
    errors.push(message.text())
  })

  return errors
}

async function expectHealthyPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

  expect(response?.status(), `${path} response status`).toBeLessThan(400)
  await expect(page.locator('body'), `${path} body`).toBeVisible()
  await expect(page.locator('body'), `${path} shell`).not.toContainText(
    /Application error|Unhandled Runtime Error|Internal Server Error/i
  )
}

async function expectAuthenticated(page: Page) {
  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0)
}

test.describe('public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.path} renders`, async ({ page }) => {
      const errors = registerPageFailureGuards(page)

      await expectHealthyPage(page, route.path)
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()

      expect(errors, `${route.path} browser errors`).toEqual([])
    })
  }
})

test.describe('authenticated app pages', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route.path} renders for the QA user`, async ({ page }) => {
      const errors = registerPageFailureGuards(page)

      await expectHealthyPage(page, route.path)
      await expectAuthenticated(page)
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()

      expect(errors, `${route.path} browser errors`).toEqual([])
    })
  }
})

test.describe('unauthenticated login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('login form accepts an email and keeps the user on the auth surface', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/login')
    await page.getByPlaceholder('you@example.com').fill('qa-check@example.com')
    await expect(page.getByPlaceholder('you@example.com')).toHaveValue(
      'qa-check@example.com'
    )
    await expect(
      page.getByRole('button', { name: /send magic link/i })
    ).toBeEnabled()

    expect(errors, 'login browser errors').toEqual([])
  })
})

test('signed-in login blocks a different email before account switch', async ({
  page,
}) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/login?next=%2Fdashboard%3Fpreview%3D1&preview=1')
  await expect(page.getByText(/Currently signed in as/i)).toBeVisible()
  await expect(
    page.getByRole('button', { name: /sign out to switch account/i })
  ).toBeVisible()

  await page
    .getByPlaceholder('you@example.com')
    .fill('not-the-current-user@example.com')
  await page.getByRole('button', { name: /continue as current account/i }).click()

  await expect(page).toHaveURL(/\/login/)
  await expect(
    page.getByText(/Sign out before opening not-the-current-user@example\.com/i)
  ).toBeVisible()

  expect(errors, 'signed-in login browser errors').toEqual([])
})

test.describe('auth callback routing', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('missing auth payload returns to preview login with context', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await page.goto('/auth/callback?next=%2Fdashboard%3Fpreview%3D1', {
      waitUntil: 'domcontentloaded',
    })

    await expect(page).toHaveURL(/\/login/)
    await expect(page).toHaveURL(/preview=1/)
    await expect(page).toHaveURL(/next=%2Fdashboard%3Fpreview%3D1/)
    await expect(page.getByText(/No auth code or token was returned/i)).toBeVisible()

    expect(errors, 'auth callback browser errors').toEqual([])
  })
})

test.describe('v3 login and dashboard wiring', () => {
  test.describe('unauthenticated preview visitor', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('dashboard preview redirects to preview login auth form', async ({ page }) => {
      const errors = registerPageFailureGuards(page)

      await page.goto('/dashboard?preview=1', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/login/)
      await expect(page).toHaveURL(/preview=1/)
      await expect(page).toHaveURL(/next=/)

      await expect(page.locator('[data-v3-login-indicator="form"]')).toBeVisible()
      await expect(page.locator('[data-v3-login-mode="preview-auth"]')).toBeVisible()
      await expect(
        page.getByRole('button', { name: /new painter/i })
      ).toBeVisible()
      await expect(page.getByRole('button', { name: /returning/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /open v3 preview/i })).toBeEnabled()
      await expect(page.getByRole('button', { name: /continue with google/i })).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate(
            () => performance.getEntriesByName('v3-login-form-hydrated').length
          )
        )
        .toBeGreaterThan(0)

      expect(errors, 'v3 preview login browser errors').toEqual([])
    })

    test('preview login uses the local dev session endpoint', async ({
      page,
    }) => {
      const errors = registerPageFailureGuards(page)
      let requestBody: { email?: string; next?: string } | null = null

      await page.route('**/auth/dev-preview-session?preview=1', async (route) => {
        requestBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ redirectTo: '/dashboard?preview=1' }),
        })
      })

      await page.goto('/login?next=%2Fdashboard%3Fpreview%3D1&preview=1', {
        waitUntil: 'domcontentloaded',
      })
      await page.getByPlaceholder('you@example.com').fill('qa-check@example.com')
      await page.getByRole('button', { name: /open v3 preview/i }).click()

      await expect
        .poll(() => requestBody)
        .toEqual({
          email: 'qa-check@example.com',
          next: '/dashboard?preview=1',
        })
      await expect(page).toHaveURL(/\/login/)

      expect(errors, 'v3 local preview auth browser errors').toEqual([])
    })
  })

  test('authenticated dashboard preview renders data indicators', async ({ page }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/dashboard?preview=1')
    await expectAuthenticated(page)
    await expect(page.locator('[data-v3-dashboard-indicator="root"]')).toBeVisible()
    await expect(page.locator('[data-v3-dashboard-feed="live"]')).toBeVisible()
    await expect(
      page.locator(
        '[data-v3-dashboard-indicator="featured-unit"], [data-v3-dashboard-indicator="featured-unit-empty"]'
      )
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Perf Benchmark Unit' })
    ).toBeVisible()
    await expect(
      page.locator('[data-v3-dashboard-indicator="active-unit"]').first()
    ).toBeVisible()
    await expect(
      page.locator('[data-v3-dashboard-active-units-layout="grid"]')
    ).toBeVisible()
    await expect
      .poll(() =>
        page.locator('[data-v3-dashboard-indicator="active-unit"]').count()
      )
      .toBeLessThanOrEqual(8)
    await expect(
      page.getByRole('button', { name: /show units as cards/i })
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: /change unit status filter, currently active/i })
      .click()
    await page.getByRole('menuitemradio', { name: /^pile$/i }).click()
    await expect(
      page.getByRole('button', {
        name: /change unit status filter, currently pile/i,
      })
    ).toBeVisible()
    await expect(page.locator('[data-v3-dashboard-indicator="next-actions"]')).toBeVisible()
    await page.getByRole('tab', { name: /my progress/i }).click()
    await expect(page.locator('[data-v3-dashboard-indicator="my-progress"]')).toBeVisible()
    await expect(page.locator('[data-v3-dashboard-indicator="xp-card"]')).toHaveCount(0)
    await expect(
      page.locator('[data-v3-dashboard-indicator="achievement-collection"]')
    ).toBeVisible()
    await expect(page.getByText(/View all seals/i)).toBeVisible()
    await expect(page.getByText(/Painting Time/i)).toBeVisible()
    await expect(page.getByText(/^Paint Streak$/i)).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(
          () => performance.getEntriesByName('v3-dashboard-hydrated').length
        )
      )
      .toBeGreaterThan(0)

    expect(errors, 'v3 dashboard browser errors').toEqual([])
  })

  test('authenticated unit preview renders a live-backed hero image source', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/dashboard?preview=1')
    await expectAuthenticated(page)

    const resumeHref = await page
      .getByRole('link', { name: /resume/i })
      .first()
      .getAttribute('href')

    expect(resumeHref).toMatch(/\/units\/.+preview=1/)
    await expectHealthyPage(page, resumeHref!)

    const hero = page.locator('[data-v3-unit-indicator="hero"]')
    await expect(hero).toBeVisible()
    await expect(page.locator('[data-v3-unit-source="live"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Perf Benchmark Unit' })).toBeVisible()

    const heroImage = await hero.getAttribute('data-v3-unit-hero-image')
    expect(heroImage).toBeTruthy()

    await page.getByRole('tab', { name: /^paint$/i }).click()
    const calendarMonth = page.locator('[data-v3-unit-calendar-month]')
    await expect(calendarMonth).toBeVisible()
    const initialMonth = await calendarMonth.getAttribute(
      'data-v3-unit-calendar-month'
    )

    await page.getByRole('button', { name: /next month/i }).click()
    await expect
      .poll(() => calendarMonth.getAttribute('data-v3-unit-calendar-month'))
      .not.toBe(initialMonth)

    await page.getByRole('button', { name: /previous month/i }).click()
    await expect
      .poll(() => calendarMonth.getAttribute('data-v3-unit-calendar-month'))
      .toBe(initialMonth)

    expect(errors, 'v3 unit preview browser errors').toEqual([])
  })

  test('authenticated projects preview renders live projects and units tabs', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/projects?preview=1')
    await expectAuthenticated(page)
    await expect(page.locator('[data-v3-projects-indicator="root"]')).toBeVisible()
    await expect(page.locator('[data-v3-projects-source="live"]')).toBeVisible()
    await expect(page.locator('[data-v3-projects-indicator="projects-list"]')).toBeVisible()
    await expect(page.getByText('Perf Benchmark Project')).toBeVisible()

    await page.getByRole('tab', { name: /^units$/i }).click()
    await expect(page.locator('[data-v3-projects-indicator="unit-card"]').first()).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Perf Benchmark Unit/ }).first()
    ).toBeVisible()

    expect(errors, 'v3 projects browser errors').toEqual([])
  })

  test('authenticated paints preview renders live collection and library tabs', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/paints?preview=1')
    await expectAuthenticated(page)
    await expect(page.locator('[data-v3-paints-indicator="root"]')).toBeVisible()
    await expect(page.locator('[data-v3-paints-source="live"]')).toBeVisible()
    await expect(
      page.locator(
        '[data-v3-paints-indicator="my-paints-grid"], [data-v3-paints-indicator="my-paints-empty"]'
      )
    ).toBeVisible()

    await page.getByRole('tab', { name: /paint library/i }).click()
    await expect(
      page.locator(
        '[data-v3-paints-indicator="library-grid"], [data-v3-paints-indicator="library-empty"]'
      )
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => performance.getEntriesByName('v3-paints-hydrated').length
        )
      )
      .toBeGreaterThan(0)

    expect(errors, 'v3 paints browser errors').toEqual([])
  })

  test('authenticated guides preview maps recipes into decks', async ({
    page,
  }) => {
    const errors = registerPageFailureGuards(page)

    await expectHealthyPage(page, '/guides?preview=1')
    await expectAuthenticated(page)
    await expect(page.locator('[data-v3-guides-indicator="root"]')).toBeVisible()
    await expect(page.locator('[data-v3-guides-source="live"]')).toBeVisible()
    await expect(page.locator('[data-v3-guides-indicator="guides-list"]')).toBeVisible()

    await page.locator('a[href^="/guides/"]:not([href^="/guides/decks/"])').first().click()
    await expect(page).toHaveURL(/\/guides\/[^/]+\?preview=1/)
    await expect(page.getByText(/Guide Detail/i)).toBeVisible()
    await page.getByRole('link', { name: /back to guides/i }).click()
    await expect(page).toHaveURL(/\/guides\?preview=1/)

    await page.getByRole('tab', { name: /^decks$/i }).click()
    await expect(page.locator('[data-v3-guides-indicator="decks-list"]')).toBeVisible()
    await expect(page.getByText(/Deck Library/i)).toBeVisible()
    await page.locator('a[href^="/guides/decks/"]').first().click()
    await expect(page).toHaveURL(/\/guides\/decks\/[^/]+\?preview=1/)
    await expect(page.getByText(/Deck Detail/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Cards$/i })).toBeVisible()
    await page.getByRole('link', { name: /back to guides/i }).click()

    await page.getByRole('tab', { name: /^library$/i }).click()
    await expect(
      page.locator('[data-v3-guides-indicator="library-decks-list"]')
    ).toBeVisible()
    await expect(page.getByPlaceholder(/search guides and decks/i)).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () => performance.getEntriesByName('v3-guides-hydrated').length
        )
      )
      .toBeGreaterThan(0)

    expect(errors, 'v3 guides browser errors').toEqual([])
  })
})

test('project library tabs and create form work', async ({ page }) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/projects')
  await expectAuthenticated(page)

  await page.getByRole('link', { name: 'New Project' }).click()
  await expect(page).toHaveURL(/\/projects\?tab=create/)
  await expect(page.getByRole('heading', { name: 'Create Project' })).toBeVisible()

  await page.getByPlaceholder('Example: Tomb Kings Army').fill('QA Project Draft')
  await expect(page.getByText('QA Project Draft')).toBeVisible()

  await page.getByRole('link', { name: 'My Projects' }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

  expect(errors, 'projects browser errors').toEqual([])
})

test('recipe tabs, search, and create form work', async ({ page }) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/recipes')
  await expectAuthenticated(page)

  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/tab=custom/)
  await expect(page.getByPlaceholder('e.g. Shadow Knight Armor')).toBeVisible()

  await page.getByPlaceholder('e.g. Shadow Knight Armor').fill('QA Guide Draft')
  await expect(page.getByText('QA Guide Draft')).toBeVisible()

  await page.getByRole('button', { name: 'Discover' }).click()
  await expect(page).toHaveURL(/tab=find/)
  await page.getByPlaceholder('Search guides by name...').fill('red')
  await expect(page.getByPlaceholder('Search guides by name...')).toHaveValue('red')

  expect(errors, 'recipes browser errors').toEqual([])
})

test('paints tabs, search, and custom paint form work', async ({ page }) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/vault')
  await expectAuthenticated(page)

  await page.getByRole('link', { name: 'Find Paint' }).click()
  await expect(page).toHaveURL(/tab=find/)
  await page.getByPlaceholder('Search by name, brand, line, or barcode').fill('red')
  await expect(
    page.getByPlaceholder('Search by name, brand, line, or barcode')
  ).toHaveValue('red')
  await expect(page).toHaveURL(/q=red/)

  await page.getByRole('link', { name: 'Custom Mix' }).click()
  await expect(page).toHaveURL(/tab=custom/)
  await page.getByPlaceholder('e.g. Void Stalker Grey').fill('QA Custom Grey')
  await expect(page.getByText('QA Custom Grey')).toBeVisible()

  expect(errors, 'vault browser errors').toEqual([])
})

test('theme tabs, search, and create form work', async ({ page }) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/themes')
  await expectAuthenticated(page)

  await page.getByRole('link', { name: 'Discover' }).click()
  await expect(page).toHaveURL(/tab=find/)
  await page.getByPlaceholder('Search themes by name or tags...').fill('spectral')
  await expect(page.getByPlaceholder('Search themes by name or tags...')).toHaveValue(
    'spectral'
  )

  await page.getByRole('link', { name: 'Create' }).click()
  await expect(page).toHaveURL(/tab=create/)
  await page.getByPlaceholder('Ghostly Ether').fill('QA Theme Draft')
  await expect(page.getByText('QA Theme Draft')).toBeVisible()

  expect(errors, 'themes browser errors').toEqual([])
})
