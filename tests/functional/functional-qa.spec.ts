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

test('login form accepts an email and keeps the user on the auth surface', async ({
  page,
}) => {
  const errors = registerPageFailureGuards(page)

  await expectHealthyPage(page, '/login')
  await page.getByPlaceholder('you@example.com').fill('qa-check@example.com')
  await expect(page.getByPlaceholder('you@example.com')).toHaveValue(
    'qa-check@example.com'
  )
  await expect(page.getByRole('button', { name: /send magic link/i })).toBeEnabled()

  expect(errors, 'login browser errors').toEqual([])
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
