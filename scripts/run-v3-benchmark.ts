import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import {
  applyStorageStateToContext,
  ensurePerfStorageState,
} from './perf-auth-utils.mjs'

type NavigationBenchmark = {
  controlReadyMs: number
  cls: number
  domContentLoaded: number
  encodedBodySize: number
  fcp: number
  inp: number
  label: string
  loadEvent: number
  lcp: number
  longTaskCount: number
  longestTask: number
  resourceCount: number
  responseMs: number
  route: string
  sample: number
  status: number
  surface: string
  detail: string
  totalBlockingTime: number
  transferSize: number
  type: 'navigation'
}

type InteractionBenchmark = {
  elapsedMs: number
  label: string
  readyMs: number
  sample: number
  surface: string
  detail: string
  type: 'interaction'
}

type ResourceBenchmark = {
  duration: number
  encodedBodySize: number
  initiatorType: string
  label: string
  name: string
  sample: number
  transferSize: number
}

type BenchmarkResult = NavigationBenchmark | InteractionBenchmark

type NavigationTarget = {
  detail: string
  label: string
  route: string
  surface: string
}

type SummaryRow = {
  avg: number
  count: number
  max: number
  median: number
  p95: number
}

const requestedPort = Number(process.env.PERF_PORT ?? 3104)
const externalBaseUrl = process.env.PERF_BASE_URL
const isWindows = process.platform === 'win32'
const samples = Math.max(1, Number(process.env.V3_BENCHMARK_SAMPLES ?? 1))
const benchmarkTimeoutMs = Number(process.env.V3_BENCHMARK_TIMEOUT_MS ?? 720_000)
const sampleTimeoutMs = Number(process.env.V3_BENCHMARK_SAMPLE_TIMEOUT_MS ?? 420_000)
const stepTimeoutMs = Number(process.env.V3_BENCHMARK_STEP_TIMEOUT_MS ?? 45_000)
const benchmarkScope = process.env.V3_BENCHMARK_SCOPE === 'full' ? 'full' : 'core'
const outputDir = resolve(process.env.V3_BENCHMARK_OUTPUT_DIR ?? '.perf/v3-benchmark')
const jsonReportPath = resolve(outputDir, 'v3-benchmark-report.json')
const markdownReportPath = resolve(outputDir, 'v3-benchmark-report.md')
const perfStorageStatePath = resolve(
  process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-flows.json'
)
const refreshPerfStorageState = process.env.PERF_REFRESH_STORAGE_STATE === '1'
const authSetupTimeoutMs = Number(process.env.V3_PERF_AUTH_TIMEOUT_MS ?? 90_000)

const BUDGETS = {
  cls: Number(process.env.V3_PERF_MAX_CLS ?? 0.1),
  controlReadyMs: Number(process.env.V3_PERF_MAX_CONTROL_READY_MS ?? 1400),
  interactionMs: Number(process.env.V3_PERF_MAX_INTERACTION_MS ?? 350),
  lcp: Number(process.env.V3_PERF_MAX_LCP_MS ?? 3200),
  longestTask: Number(process.env.V3_PERF_MAX_LONG_TASK_MS ?? 350),
  responseMs: Number(process.env.V3_PERF_MAX_RESPONSE_MS ?? 2200),
  totalBlockingTime: Number(process.env.V3_BENCHMARK_MAX_TBT_MS ?? 600),
  transferSize: Number(process.env.V3_BENCHMARK_MAX_TRANSFER_BYTES ?? 1_500_000),
}

const MAIN_PAGE_TARGETS: NavigationTarget[] = [
  {
    detail: 'active-units',
    label: 'Dashboard / Active Units',
    route: '/dashboard?preview=1',
    surface: 'dashboard',
  },
  {
    detail: 'projects',
    label: 'Projects / Projects',
    route: '/projects?preview=1',
    surface: 'projects',
  },
  {
    detail: 'owned',
    label: 'Paints / My Paints',
    route: '/paints?preview=1',
    surface: 'paints',
  },
  {
    detail: 'guides',
    label: 'Guides / Guides',
    route: '/guides?preview=1',
    surface: 'guides',
  },
  {
    detail: 'feed',
    label: 'Community / Feed',
    route: '/community?preview=1',
    surface: 'community',
  },
]

const SUPPORTING_TARGETS: NavigationTarget[] = [
  {
    detail: 'main',
    label: 'Settings',
    route: '/settings?preview=1',
    surface: 'settings',
  },
  {
    detail: 'mine',
    label: 'Themes / My Themes',
    route: '/themes?preview=1',
    surface: 'themes',
  },
]

function bin(name: string) {
  return `node_modules${isWindows ? '\\' : '/'} .bin`
    .replace(' ', '')
    .concat(`${isWindows ? '\\' : '/'}${name}${isWindows ? '.cmd' : ''}`)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentileValue / 100) * sorted.length) - 1
  )
  return sorted[Math.max(0, index)]
}

function summarize(values: number[]): SummaryRow {
  if (!values.length) {
    return { avg: 0, count: 0, max: 0, median: 0, p95: 0 }
  }

  return {
    avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    count: values.length,
    max: Math.max(...values),
    median: percentile(values, 50),
    p95: percentile(values, 95),
  }
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`
  return `${bytes} B`
}

function storageStateMatchesBaseUrl(storageStatePath: string, baseUrl: string) {
  if (!existsSync(storageStatePath)) return false

  try {
    const hostname = new URL(baseUrl).hostname
    const storageState = JSON.parse(readFileSync(storageStatePath, 'utf8')) as {
      cookies?: Array<{ domain?: string; name?: string; value?: string }>
    }
    const authCookie = storageState.cookies?.find(
      (cookie) => cookie.domain === hostname && cookie.name?.endsWith('-auth-token')
    )

    if (!authCookie?.value) return false

    const session = JSON.parse(
      Buffer.from(authCookie.value.replace(/^base64-/, ''), 'base64').toString(
        'utf8'
      )
    ) as { expires_at?: number }

    return (session.expires_at ?? 0) > Math.floor(Date.now() / 1000) + 300
  } catch {
    return false
  }
}

async function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function findAvailablePort(startPort: number, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset
    if (await canListen(port)) return port
  }

  throw new Error(`Could not find an available port from ${startPort}`)
}

async function waitForServer(baseUrl: string) {
  const deadline = Date.now() + 30_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login?preview=1`, {
        redirect: 'manual',
      })
      if (response.status > 0) return
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`V3 benchmark server did not become ready: ${String(lastError)}`)
}

function spawnCommand(command: string, args: string[], env = process.env) {
  const commandArgs = isWindows ? ['/c', command, ...args] : args

  return spawn(isWindows ? 'cmd.exe' : command, commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
}

async function stopServer(server: ChildProcess | null) {
  if (!server?.pid || server.exitCode !== null) return

  if (isWindows) {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('exit', () => resolve())
      killer.once('error', () => resolve())
    })
    return
  }

  server.kill('SIGTERM')
}

async function withTimeout<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs: number
) {
  let timeout: NodeJS.Timeout | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function benchmarkStep<T>(label: string, promise: Promise<T>) {
  console.log(`- ${label}`)
  return withTimeout(label, promise, stepTimeoutMs)
}

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    const state = {
      cls: 0,
      inp: 0,
      lcp: 0,
      longTaskCount: 0,
      longestTask: 0,
      totalBlockingTime: 0,
    }

    Object.defineProperty(window, '__v3BenchmarkPerfState', {
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
          state.totalBlockingTime += Math.max(0, entry.duration - 50)
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    } catch {}

    try {
      const eventObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const eventEntry = entry as PerformanceEntry & {
            duration?: number
            interactionId?: number
          }
          if (eventEntry.interactionId) {
            state.inp = Math.max(state.inp, eventEntry.duration || 0)
          }
        }
      })
      eventObserver.observe({
        durationThreshold: 16,
        type: 'event',
        buffered: true,
      } as PerformanceObserverInit)
    } catch {}
  })
}

async function readPageSnapshot(page: Page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const state = (window as typeof window & {
      __v3BenchmarkPerfState?: {
        cls: number
        inp: number
        lcp: number
        longTaskCount: number
        longestTask: number
        totalBlockingTime: number
      }
    }).__v3BenchmarkPerfState ?? {
      cls: 0,
      inp: 0,
      lcp: 0,
      longTaskCount: 0,
      longestTask: 0,
      totalBlockingTime: 0,
    }
    const paintEntries = performance.getEntriesByType('paint')
    const firstContentfulPaint =
      paintEntries.find((entry) => entry.name === 'first-contentful-paint')
        ?.startTime ?? 0

    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming
        return {
          duration: Math.round(resource.duration),
          encodedBodySize: resource.encodedBodySize,
          initiatorType: resource.initiatorType,
          name: resource.name,
          transferSize: resource.transferSize,
        }
      })
      .sort((first, second) => second.duration - first.duration)
      .slice(0, 15)

    return {
      cls: Number(state.cls.toFixed(3)),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      encodedBodySize: nav?.encodedBodySize ?? 0,
      fcp: Math.round(firstContentfulPaint),
      inp: Math.round(state.inp),
      lcp: Math.round(state.lcp),
      loadEvent: Math.round(nav?.loadEventEnd ?? 0),
      longTaskCount: state.longTaskCount,
      longestTask: Math.round(state.longestTask),
      resources,
      resourceCount: performance.getEntriesByType('resource').length,
      totalBlockingTime: Math.round(state.totalBlockingTime),
      transferSize: nav?.transferSize ?? 0,
    }
  })
}

async function waitForV3Indicator(page: Page, surface: string, detail: string) {
  const selector = `[data-v3-perf-indicator="${surface}"][data-v3-perf-detail="${detail}"]`
  await page.locator(selector).first().waitFor({ state: 'attached', timeout: 15_000 })
  const markName = await page.locator(selector).first().getAttribute('data-v3-perf-mark')
  if (!markName) throw new Error(`Missing V3 perf mark for ${surface}:${detail}`)

  await page.waitForFunction(
    (name) => performance.getEntriesByName(name).length > 0,
    markName,
    { timeout: 15_000 }
  )

  return markName
}

async function waitForNextV3Mark(
  page: Page,
  surface: string,
  detail: string,
  previousCount: number
) {
  const markName = `v3-${surface}-${detail}-hydrated`
  await page.waitForFunction(
    ({ name, count }) => performance.getEntriesByName(name).length > count,
    { count: previousCount, name: markName },
    { timeout: 15_000 }
  )
}

async function markCount(page: Page, surface: string, detail: string) {
  return page.evaluate(
    (name) => performance.getEntriesByName(name).length,
    `v3-${surface}-${detail}-hydrated`
  )
}

async function measureNavigation(
  page: Page,
  target: NavigationTarget,
  sample: number,
  resources: ResourceBenchmark[]
): Promise<NavigationBenchmark> {
  console.log(`- ${target.label} (${target.route})`)
  const started = performance.now()
  const response = await page.goto(target.route, { waitUntil: 'commit' })
  const responseMs = Math.round(performance.now() - started)

  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
  await waitForV3Indicator(page, target.surface, target.detail)
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(350)

  const controlReadyStarted = performance.now()
  const firstControl = page.locator('button, input, select, textarea, a[href]').first()
  if ((await firstControl.count()) > 0) {
    await firstControl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
  }
  const controlReadyMs = Math.round(performance.now() - controlReadyStarted)
  const snapshot = await readPageSnapshot(page)

  resources.push(
    ...snapshot.resources.map((resource) => ({
      ...resource,
      label: target.label,
      sample,
    }))
  )

  return {
    cls: snapshot.cls,
    controlReadyMs,
    detail: target.detail,
    domContentLoaded: snapshot.domContentLoaded,
    encodedBodySize: snapshot.encodedBodySize,
    fcp: snapshot.fcp,
    inp: snapshot.inp,
    label: target.label,
    lcp: snapshot.lcp,
    loadEvent: snapshot.loadEvent,
    longTaskCount: snapshot.longTaskCount,
    longestTask: snapshot.longestTask,
    resourceCount: snapshot.resourceCount,
    responseMs,
    route: target.route,
    sample,
    status: response?.status() ?? 0,
    surface: target.surface,
    totalBlockingTime: snapshot.totalBlockingTime,
    transferSize: snapshot.transferSize,
    type: 'navigation',
  }
}

async function measureInteraction(
  page: Page,
  label: string,
  surface: string,
  detail: string,
  sample: number,
  action: () => Promise<void>,
  waitForReadyMark = true
): Promise<InteractionBenchmark> {
  console.log(`- ${label}`)
  const previousCount = await markCount(page, surface, detail).catch(() => 0)
  const started = performance.now()
  await action()
  const elapsedMs = Math.round(performance.now() - started)
  const readyStarted = performance.now()
  if (waitForReadyMark) {
    await waitForNextV3Mark(page, surface, detail, previousCount)
  }
  const readyMs = waitForReadyMark
    ? Math.round(performance.now() - readyStarted)
    : elapsedMs
  await page.waitForTimeout(150)

  return {
    detail,
    elapsedMs,
    label,
    readyMs,
    sample,
    surface,
    type: 'interaction',
  }
}

async function clickTab(
  page: Page,
  name: RegExp,
  label: string,
  surface: string,
  detail: string,
  sample: number,
  results: BenchmarkResult[]
) {
  results.push(
    await measureInteraction(page, label, surface, detail, sample, () =>
      page.getByRole('tab', { name }).click()
    )
  )
}

async function firstHref(page: Page, selector: string) {
  return page.locator(selector).first().getAttribute('href')
}

async function runLoginAndOnboarding(
  page: Page,
  sample: number,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  results.push(
    await measureNavigation(
      page,
      {
        detail: 'preview',
        label: 'Login / Preview',
        route: '/login?preview=1',
        surface: 'login',
      },
      sample,
      resources
    )
  )
  results.push(
    await measureInteraction(
      page,
      'Login / Start Here',
      'login',
      'preview',
      sample,
      () => page.getByRole('button', { name: /start here/i }).click()
    )
  )

  results.push(
    await measureNavigation(
      page,
      {
        detail: 'terms',
        label: 'Onboarding / Terms',
        route: '/onboarding?preview=1&reset=v3-benchmark',
        surface: 'onboarding',
      },
      sample,
      resources
    )
  )
  await page.getByRole('checkbox').first().check()
  results.push(
    await measureInteraction(
      page,
      'Onboarding / Accept Terms',
      'onboarding',
      'persona',
      sample,
      () => page.getByRole('button', { name: /accept and continue/i }).click()
    )
  )
  results.push(
    await measureInteraction(
      page,
      'Onboarding / Choose Miniature Goal',
      'onboarding',
      'persona',
      sample,
      () => page.getByRole('button', { name: /help me paint a miniature/i }).click(),
      false
    )
  )
  results.push(
    await measureInteraction(
      page,
      'Onboarding / Continue To Creation',
      'onboarding',
      'creation',
      sample,
      () => page.getByRole('button', { name: /start my first miniature/i }).click()
    )
  )
  results.push(
    await measureInteraction(
      page,
      'Onboarding / Skip Creation',
      'onboarding',
      'curator',
      sample,
      () => page.getByRole('button', { name: /i'll add one later/i }).click()
    )
  )
  results.push(
    await measureInteraction(
      page,
      'Onboarding / Enter Gallery',
      'dashboard',
      'active-units',
      sample,
      () => page.getByRole('button', { name: /enter the gallery/i }).click()
    )
  )
}

async function runMainPages(
  page: Page,
  sample: number,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  for (const target of MAIN_PAGE_TARGETS) {
    results.push(await measureNavigation(page, target, sample, resources))
    if (benchmarkScope === 'core') continue

    if (target.surface === 'dashboard') {
      await clickTab(
        page,
        /my progress/i,
        'Dashboard / My Progress tab',
        'dashboard',
        'my-progress',
        sample,
        results
      )
      await clickTab(
        page,
        /active units/i,
        'Dashboard / Active Units tab',
        'dashboard',
        'active-units',
        sample,
        results
      )
    }

    if (target.surface === 'projects') {
      await clickTab(page, /units/i, 'Projects / Units tab', 'projects', 'units', sample, results)
      await clickTab(
        page,
        /projects/i,
        'Projects / Projects tab',
        'projects',
        'projects',
        sample,
        results
      )
    }

    if (target.surface === 'paints') {
      await clickTab(
        page,
        /paint library/i,
        'Paints / Library tab',
        'paints',
        'library',
        sample,
        results
      )
      await clickTab(page, /my paints/i, 'Paints / My Paints tab', 'paints', 'owned', sample, results)
    }

    if (target.surface === 'guides') {
      await clickTab(page, /decks/i, 'Guides / Decks tab', 'guides', 'decks', sample, results)
      await clickTab(
        page,
        /library/i,
        'Guides / Library tab',
        'guides',
        'library',
        sample,
        results
      )
      await clickTab(page, /^guides$/i, 'Guides / Guides tab', 'guides', 'guides', sample, results)
    }

    if (target.surface === 'community') {
      await clickTab(
        page,
        /contests/i,
        'Community / Contests tab',
        'community',
        'contests',
        sample,
        results
      )
      await clickTab(page, /news/i, 'Community / News tab', 'community', 'news', sample, results)
      await clickTab(
        page,
        /events/i,
        'Community / Events tab',
        'community',
        'events',
        sample,
        results
      )
      await clickTab(page, /feed/i, 'Community / Feed tab', 'community', 'feed', sample, results)
    }
  }
}

async function runSubpages(
  page: Page,
  sample: number,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  results.push(
    await measureNavigation(
      page,
      {
        detail: 'projects',
        label: 'Projects / Resolve Project Detail',
        route: '/projects?preview=1',
        surface: 'projects',
      },
      sample,
      resources
    )
  )
  const projectHref = await firstHref(page, 'a[href^="/projects/"][href*="preview=1"]')
  if (projectHref) {
    results.push(
      await measureNavigation(
        page,
        {
          detail: 'units',
          label: 'Project Detail / Units',
          route: projectHref,
          surface: 'project-detail',
        },
        sample,
        resources
      )
    )
    await clickTab(
      page,
      /project details/i,
      'Project Detail / Details tab',
      'project-detail',
      'details',
      sample,
      results
    )
    await clickTab(
      page,
      /add units/i,
      'Project Detail / Add Units tab',
      'project-detail',
      'add',
      sample,
      results
    )
  }

  results.push(
    await measureNavigation(
      page,
      {
        detail: 'units',
        label: 'Projects / Resolve Unit Detail',
        route: '/projects?preview=1',
        surface: 'projects',
      },
      sample,
      resources
    )
  )
  await page.getByRole('tab', { name: /units/i }).click()
  await waitForV3Indicator(page, 'projects', 'units')
  const unitHref = await firstHref(page, 'a[href^="/units/"][href*="preview=1"]')
  if (unitHref) {
    results.push(
      await measureNavigation(
        page,
        {
          detail: 'details',
          label: 'Unit Detail / Details',
          route: unitHref,
          surface: 'unit',
        },
        sample,
        resources
      )
    )
    await clickTab(page, /paint/i, 'Unit Detail / Paint tab', 'unit', 'paint', sample, results)
    await clickTab(
      page,
      /progress/i,
      'Unit Detail / Progress tab',
      'unit',
      'progress',
      sample,
      results
    )
  }

  results.push(
    await measureNavigation(
      page,
      {
        detail: 'guides',
        label: 'Guides / Resolve Guide Detail',
        route: '/guides?preview=1',
        surface: 'guides',
      },
      sample,
      resources
    )
  )
  const guideHref = await firstHref(
    page,
    'a[href^="/guides/"][href*="preview=1"]:not([href^="/guides/decks/"])'
  )
  if (guideHref) {
    results.push(
      await measureNavigation(
        page,
        {
          detail: 'main',
          label: 'Guide Detail',
          route: guideHref,
          surface: 'guide-detail',
        },
        sample,
        resources
      )
    )
  }

  results.push(
    await measureNavigation(
      page,
      {
        detail: 'guides',
        label: 'Guides / Resolve Deck Detail',
        route: '/guides?preview=1',
        surface: 'guides',
      },
      sample,
      resources
    )
  )
  await page.getByRole('tab', { name: /decks/i }).click()
  await waitForV3Indicator(page, 'guides', 'decks')
  const deckHref = await firstHref(page, 'a[href^="/guides/decks/"][href*="preview=1"]')
  if (deckHref) {
    results.push(
      await measureNavigation(
        page,
        {
          detail: 'main',
          label: 'Deck Detail',
          route: deckHref,
          surface: 'deck-detail',
        },
        sample,
        resources
      )
    )
  }
}

async function runSupportingSurfaces(
  page: Page,
  sample: number,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  for (const target of SUPPORTING_TARGETS) {
    results.push(await measureNavigation(page, target, sample, resources))
    if (target.surface === 'themes') {
      await clickTab(
        page,
        /theme library/i,
        'Themes / Library tab',
        'themes',
        'library',
        sample,
        results
      )
      await clickTab(
        page,
        /my themes/i,
        'Themes / My Themes tab',
        'themes',
        'mine',
        sample,
        results
      )
    }
  }
}

function groupedNavigationSummaries(results: BenchmarkResult[]) {
  const groups = new Map<string, NavigationBenchmark[]>()
  for (const result of results) {
    if (result.type !== 'navigation') continue
    groups.set(result.label, [...(groups.get(result.label) ?? []), result])
  }

  return Array.from(groups.entries()).map(([label, rows]) => ({
    cls: summarize(rows.map((row) => row.cls * 1000)),
    controlReadyMs: summarize(rows.map((row) => row.controlReadyMs)),
    domContentLoaded: summarize(rows.map((row) => row.domContentLoaded)),
    fcp: summarize(rows.map((row) => row.fcp)),
    inp: summarize(rows.map((row) => row.inp)),
    label,
    lcp: summarize(rows.map((row) => row.lcp)),
    longestTask: summarize(rows.map((row) => row.longestTask)),
    responseMs: summarize(rows.map((row) => row.responseMs)),
    route: rows[0].route,
    totalBlockingTime: summarize(rows.map((row) => row.totalBlockingTime)),
    transferSize: summarize(rows.map((row) => row.transferSize)),
  }))
}

function groupedInteractionSummaries(results: BenchmarkResult[]) {
  const groups = new Map<string, InteractionBenchmark[]>()
  for (const result of results) {
    if (result.type !== 'interaction') continue
    groups.set(result.label, [...(groups.get(result.label) ?? []), result])
  }

  return Array.from(groups.entries()).map(([label, rows]) => ({
    elapsedMs: summarize(rows.map((row) => row.elapsedMs)),
    label,
    readyMs: summarize(rows.map((row) => row.readyMs)),
  }))
}

function scoreNavigationBottleneck(row: ReturnType<typeof groupedNavigationSummaries>[number]) {
  const ratios = [
    row.responseMs.p95 / BUDGETS.responseMs,
    row.fcp.p95 / BUDGETS.lcp,
    row.lcp.p95 / BUDGETS.lcp,
    row.controlReadyMs.p95 / BUDGETS.controlReadyMs,
    row.longestTask.p95 / BUDGETS.longestTask,
    row.totalBlockingTime.p95 / BUDGETS.totalBlockingTime,
    row.transferSize.p95 / BUDGETS.transferSize,
    row.cls.p95 / (BUDGETS.cls * 1000),
  ]
  return Math.max(...ratios)
}

function topResourceSummaries(resources: ResourceBenchmark[]) {
  const groups = new Map<string, ResourceBenchmark[]>()
  for (const resource of resources) {
    const url = new URL(resource.name)
    const key = `${resource.initiatorType} ${url.pathname}${url.search}`
    groups.set(key, [...(groups.get(key) ?? []), resource])
  }

  return Array.from(groups.entries())
    .map(([name, rows]) => ({
      duration: summarize(rows.map((row) => row.duration)),
      encodedBodySize: summarize(rows.map((row) => row.encodedBodySize)),
      labels: Array.from(new Set(rows.map((row) => row.label))).slice(0, 4),
      name,
      transferSize: summarize(rows.map((row) => row.transferSize)),
    }))
    .sort((first, second) => second.duration.p95 - first.duration.p95)
    .slice(0, 15)
}

function createMarkdownReport(
  baseUrl: string,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  const navigation = groupedNavigationSummaries(results)
  const interactions = groupedInteractionSummaries(results)
  const bottlenecks = [...navigation]
    .sort((first, second) => scoreNavigationBottleneck(second) - scoreNavigationBottleneck(first))
    .slice(0, 10)
  const slowInteractions = [...interactions]
    .sort((first, second) => second.elapsedMs.p95 - first.elapsedMs.p95)
    .slice(0, 10)
  const resourceRows = topResourceSummaries(resources)

  const lines = [
    '# V3 Benchmark Performance Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${baseUrl}`,
    `Scope: ${benchmarkScope}`,
    `Samples per route/interaction: ${samples}`,
    `Timeouts: run ${Math.round(benchmarkTimeoutMs / 1000)}s, sample ${Math.round(sampleTimeoutMs / 1000)}s, step ${Math.round(stepTimeoutMs / 1000)}s`,
    '',
    '## Main Bottlenecks',
    '',
    '| Rank | Surface | p95 response | p95 FCP | p95 LCP | p95 INP | p95 control | p95 longest task | p95 TBT | p95 transfer |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...bottlenecks.map(
      (row, index) =>
        `| ${index + 1} | ${row.label} | ${row.responseMs.p95}ms | ${row.fcp.p95}ms | ${row.lcp.p95}ms | ${row.inp.p95}ms | ${row.controlReadyMs.p95}ms | ${row.longestTask.p95}ms | ${row.totalBlockingTime.p95}ms | ${formatBytes(row.transferSize.p95)} |`
    ),
    '',
    '## Navigation Coverage',
    '',
    '| Surface | Route | p95 response | p95 DCL | p95 FCP | p95 LCP | p95 INP | p95 control | p95 CLS | p95 longest task | p95 TBT | p95 transfer |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...navigation.map(
      (row) =>
        `| ${row.label} | \`${row.route}\` | ${row.responseMs.p95}ms | ${row.domContentLoaded.p95}ms | ${row.fcp.p95}ms | ${row.lcp.p95}ms | ${row.inp.p95}ms | ${row.controlReadyMs.p95}ms | ${(row.cls.p95 / 1000).toFixed(3)} | ${row.longestTask.p95}ms | ${row.totalBlockingTime.p95}ms | ${formatBytes(row.transferSize.p95)} |`
    ),
    '',
    '## Interaction Coverage',
    '',
    '| Interaction | p95 event | p95 ready mark |',
    '| --- | ---: | ---: |',
    ...interactions.map(
      (row) => `| ${row.label} | ${row.elapsedMs.p95}ms | ${row.readyMs.p95}ms |`
    ),
    '',
    '## Slowest Interactions',
    '',
    '| Rank | Interaction | p95 event | p95 ready mark |',
    '| --- | --- | ---: | ---: |',
    ...slowInteractions.map(
      (row, index) =>
        `| ${index + 1} | ${row.label} | ${row.elapsedMs.p95}ms | ${row.readyMs.p95}ms |`
    ),
    '',
    '## Slowest Resources',
    '',
    '| Resource | Initiator/path | p95 duration | p95 transfer | Seen on |',
    '| --- | --- | ---: | ---: | --- |',
    ...resourceRows.map(
      (row) =>
        `| ${row.name.split(' ')[0]} | \`${row.name.slice(row.name.indexOf(' ') + 1)}\` | ${row.duration.p95}ms | ${formatBytes(row.transferSize.p95)} | ${row.labels.join(', ')} |`
    ),
    '',
    '## Budget Reference',
    '',
    `Response ${BUDGETS.responseMs}ms, FCP/LCP soft reference ${BUDGETS.lcp}ms, control ready ${BUDGETS.controlReadyMs}ms, longest task ${BUDGETS.longestTask}ms, TBT ${BUDGETS.totalBlockingTime}ms, CLS ${BUDGETS.cls}. INP is best-effort lab event timing and can be 0 on pages without input.`,
    '',
  ]

  return lines.join('\n')
}

async function createBrowserContext(browser: Browser, baseUrl: string) {
  const context = await browser.newContext({
    baseURL: baseUrl,
    storageState: existsSync(perfStorageStatePath) ? perfStorageStatePath : undefined,
    viewport: { height: 932, width: 430 },
  })
  context.setDefaultNavigationTimeout(stepTimeoutMs)
  context.setDefaultTimeout(Math.min(stepTimeoutMs, 15_000))

  await applyStorageStateToContext({
    baseUrl,
    context,
    storageStatePath: perfStorageStatePath,
  })

  return context
}

async function runSample(
  context: BrowserContext,
  sample: number,
  results: BenchmarkResult[],
  resources: ResourceBenchmark[]
) {
  const page = await context.newPage()
  await installPerfObservers(page)

  try {
    console.log(`\nV3 benchmark sample ${sample}/${samples}`)
    await withTimeout(
      `V3 benchmark sample ${sample}`,
      (async () => {
        await runLoginAndOnboarding(page, sample, results, resources)
        await runMainPages(page, sample, results, resources)
        if (benchmarkScope === 'full') {
          await runSubpages(page, sample, results, resources)
          await runSupportingSurfaces(page, sample, results, resources)
        }
      })(),
      sampleTimeoutMs
    )
  } finally {
    await page.close()
  }
}

async function main() {
  console.log('V3 Benchmark Perf Test')

  const port = externalBaseUrl ? requestedPort : await findAvailablePort(requestedPort)
  const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`
  const server = externalBaseUrl
    ? null
    : spawnCommand(bin('next'), ['start', '-p', String(port)])
  let activeBrowser: Browser | null = null
  const closeActiveBrowser = async () => {
    const browser = activeBrowser
    activeBrowser = null
    await browser?.close().catch(() => {})
  }
  const watchdog = setTimeout(async () => {
    console.error(
      `V3 benchmark exceeded ${benchmarkTimeoutMs}ms. Stopping browser and server.`
    )
    await closeActiveBrowser()
    await stopServer(server)
    process.exit(124)
  }, benchmarkTimeoutMs + 5000)

  const stopOnSignal = async () => {
    clearTimeout(watchdog)
    await closeActiveBrowser()
    await stopServer(server)
    process.exit(130)
  }

  process.once('SIGINT', stopOnSignal)
  process.once('SIGTERM', stopOnSignal)

  const results: BenchmarkResult[] = []
  const resources: ResourceBenchmark[] = []

  try {
    await waitForServer(baseUrl)
    const shouldCreateStorageState =
      refreshPerfStorageState ||
      !storageStateMatchesBaseUrl(perfStorageStatePath, baseUrl)

    if (shouldCreateStorageState) {
      console.log(`Creating fresh perf auth state for ${baseUrl}`)
      await withTimeout(
        'V3 benchmark auth setup',
        ensurePerfStorageState({
          baseUrl,
          storageStatePath: perfStorageStatePath,
        }),
        authSetupTimeoutMs
      )
    } else {
      console.log(`Reusing perf auth state at ${perfStorageStatePath}`)
    }

    await withTimeout(
      'V3 benchmark run',
      (async () => {
        const browser = await chromium.launch({ headless: true })
        activeBrowser = browser
        try {
          const context = await createBrowserContext(browser, baseUrl)
          try {
            for (let sample = 1; sample <= samples; sample += 1) {
              await runSample(context, sample, results, resources)
            }
          } finally {
            await context.close()
          }
        } finally {
          await browser.close()
          activeBrowser = null
        }
      })(),
      benchmarkTimeoutMs
    )

    mkdirSync(dirname(jsonReportPath), { recursive: true })
    const navigation = groupedNavigationSummaries(results)
    const interactions = groupedInteractionSummaries(results)
    const report = {
      baseUrl,
      budgets: BUDGETS,
      generatedAt: new Date().toISOString(),
      interactions,
      navigation,
      resources: topResourceSummaries(resources),
      samples,
      rawResults: results,
    }

    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2))
    writeFileSync(markdownReportPath, createMarkdownReport(baseUrl, results, resources))

    console.log(`\nV3 benchmark report written to ${markdownReportPath}`)
    console.log(`V3 benchmark raw JSON written to ${jsonReportPath}`)
  } finally {
    clearTimeout(watchdog)
    await closeActiveBrowser()
    await stopServer(server)
  }
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
