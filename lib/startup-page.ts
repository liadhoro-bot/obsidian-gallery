export const STARTUP_PAGES = [
  'dashboard',
  'projects',
  'paints',
  'guides',
  'community',
] as const

export type StartupPage = (typeof STARTUP_PAGES)[number]

export const DEFAULT_STARTUP_PAGE: StartupPage = 'dashboard'

export function isStartupPage(value: unknown): value is StartupPage {
  return typeof value === 'string' && STARTUP_PAGES.includes(value as StartupPage)
}

export function getStartupPage(value: unknown): StartupPage {
  return isStartupPage(value) ? value : DEFAULT_STARTUP_PAGE
}

export function getStartupPath(page: StartupPage, preview = false) {
  const path = `/${page}`

  if (!preview || page === 'dashboard') {
    return path
  }

  return `${path}?preview=1`
}
