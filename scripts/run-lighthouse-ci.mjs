import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { resolve } from 'node:path'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'
import {
  applyStorageStateToContext,
  BENCHMARK_UNIT_ID,
  ensurePerfStorageState,
} from './perf-auth-utils.mjs'

const importantOnly = process.env.PERF_IMPORTANT_ONLY === '1'

const MAIN_ROUTES = [
  { path: '/dashboard?preview=1', requiresAuth: true },
  { path: '/projects?preview=1', requiresAuth: true },
  { path: '/paints?preview=1', requiresAuth: true },
  { path: '/guides?preview=1', requiresAuth: true },
  { path: '/themes?preview=1', requiresAuth: true },
  { path: '/community?preview=1', requiresAuth: true },
  { path: '/settings?preview=1', requiresAuth: true },
]

const SECONDARY_ROUTES = [
  { path: '/login?preview=1', requiresAuth: false },
  { path: '/onboarding?preview=1&reset=v3-lighthouse', requiresAuth: true },
]

const routes = importantOnly ? MAIN_ROUTES : [...MAIN_ROUTES, ...SECONDARY_ROUTES]

const requiredMainPerformanceRoutes = MAIN_ROUTES.map((route) => route.path)
const RETIRED_V2_ROUTE_PATTERNS = [/^\/recipes(?:\/|\?|$)/, /^\/vault(?:\/|\?|$)/]

const budgets = {
  largestContentfulPaint: 3200,
  cumulativeLayoutShift: 0.1,
  totalBlockingTime: 600,
  scriptKb: 300,
  imageKb: 700,
  totalKb: 1400,
}

const isWindows = process.platform === 'win32'
const externalBaseUrl = process.env.PERF_BASE_URL
const requestedAppPort = Number(process.env.PERF_LIGHTHOUSE_APP_PORT ?? 3100)
const requestedChromePort = Number(process.env.PERF_LIGHTHOUSE_CHROME_PORT ?? 9229)
const outputDir = resolve('.lighthouseci')
const perfStorageStatePath = resolve(
  process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-lighthouse.json'
)
const reusePerfStorageState = process.env.PERF_REUSE_STORAGE_STATE === '1'
const chromeUserDataDir = resolve('.perf/lighthouse-browser-profile')

function bin(name) {
  return `node_modules${isWindows ? '\\' : '/'} .bin`
    .replace(' ', '')
    .concat(`${isWindows ? '\\' : '/'}${name}${isWindows ? '.cmd' : ''}`)
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

function spawnCommand(command, args, env = process.env) {
  const commandArgs = isWindows ? ['/c', command, ...args] : args

  return spawn(isWindows ? 'cmd.exe' : command, commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
}

function canListen(port) {
  return new Promise((resolvePort) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolvePort(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolvePort(true))
    })
  })
}

async function findAvailablePort(startPort, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset
    if (await canListen(port)) return port
  }

  throw new Error(`Could not find an available port from ${startPort}`)
}

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 30_000
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login?preview=1`, { redirect: 'manual' })
      if (response.status > 0) return
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`Lighthouse server did not become ready: ${String(lastError)}`)
}

async function stopServer(server) {
  if (!server?.pid || server.exitCode !== null) return

  if (isWindows) {
    await new Promise((resolveKill) => {
      const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('exit', () => resolveKill())
      killer.once('error', () => resolveKill())
    })
    return
  }

  server.kill('SIGTERM')
}

function numericAudit(lhr, id) {
  return lhr.audits[id]?.numericValue ?? 0
}

function resourceKb(lhr, resourceType) {
  const items = lhr.audits['resource-summary']?.details?.items ?? []
  const item = items.find((entry) => entry.resourceType === resourceType)
  return Math.round(((item?.transferSize ?? 0) / 1024) * 10) / 10
}

function assertBudget(failures, route, metric, actual, budget, unit = 'ms') {
  if (actual <= budget) return

  failures.push({
    route,
    metric,
    actual: `${actual}${unit}`,
    budget: `${budget}${unit}`,
  })
}

function assertRouteCoverage() {
  const measuredRoutes = new Set(routes.map((route) => route.path))

  if (measuredRoutes.size !== routes.length) {
    throw new Error('Lighthouse performance route matrix contains duplicate paths.')
  }

  const missingRoutes = requiredMainPerformanceRoutes.filter(
    (route) => !measuredRoutes.has(route)
  )

  if (missingRoutes.length) {
    throw new Error(
      `Lighthouse performance route matrix is missing: ${missingRoutes.join(', ')}`
    )
  }

  const retiredRoutes = routes
    .map((route) => route.path)
    .filter((path) => RETIRED_V2_ROUTE_PATTERNS.some((pattern) => pattern.test(path)))

  if (retiredRoutes.length) {
    throw new Error(
      `V3 Lighthouse route matrix includes retired V2 routes: ${retiredRoutes.join(', ')}`
    )
  }

  const nonPreviewRoutes = routes
    .map((route) => route.path)
    .filter((path) => !path.includes('preview=1'))

  if (nonPreviewRoutes.length) {
    throw new Error(
      `V3 Lighthouse route matrix must target published preview=1 surfaces only: ${nonPreviewRoutes.join(', ')}`
    )
  }
}

function formatMetricLine(route, score, lcp, tbt, cls, scriptKb, imageKb, totalKb) {
  return [
    route.padEnd(28),
    `score=${String(score).padStart(3)}`,
    `LCP=${String(lcp).padStart(4)}ms`,
    `TBT=${String(tbt).padStart(4)}ms`,
    `CLS=${cls}`,
    `JS=${scriptKb}KB`,
    `IMG=${imageKb}KB`,
    `TOTAL=${totalKb}KB`,
  ].join('  ')
}

async function resolveFirstPreviewHref(context, baseUrl, listingPath, hrefPattern) {
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}${listingPath}`, { waitUntil: 'networkidle' })

    return await page.evaluate((patternSource) => {
      const regex = new RegExp(patternSource)
      const links = Array.from(document.querySelectorAll('a[href]'))
      const match = links
        .map((link) => link.getAttribute('href'))
        .find((href) => typeof href === 'string' && regex.test(href))

      return match ?? null
    }, hrefPattern.source)
  } finally {
    await page.close()
  }
}

async function resolveDetailRoutes(context, baseUrl) {
  const detailRoutes = []

  const projectHref = await resolveFirstPreviewHref(
    context,
    baseUrl,
    '/projects?preview=1',
    /^\/projects\/[^/?#]+\?preview=1/
  )
  if (projectHref) {
    detailRoutes.push({
      path: projectHref,
      requiresAuth: true,
      expectedPathname: new URL(projectHref, baseUrl).pathname,
    })
  }

  detailRoutes.push({
    path: `/units/${BENCHMARK_UNIT_ID}?preview=1`,
    requiresAuth: true,
    expectedPathname: `/units/${BENCHMARK_UNIT_ID}`,
  })

  const guideHref = await resolveFirstPreviewHref(
    context,
    baseUrl,
    '/guides?preview=1',
    /^\/guides\/(?!decks\/)[^/?#]+\?preview=1/
  )
  if (guideHref) {
    detailRoutes.push({
      path: guideHref,
      requiresAuth: true,
      expectedPathname: new URL(guideHref, baseUrl).pathname,
    })
  }

  return detailRoutes
}

function assertV3Route(route) {
  if (RETIRED_V2_ROUTE_PATTERNS.some((pattern) => pattern.test(route.path))) {
    throw new Error(`Refusing to run retired V2 Lighthouse route: ${route.path}`)
  }

  if (!route.path.includes('preview=1')) {
    throw new Error(`Refusing to run non-V3 preview Lighthouse route: ${route.path}`)
  }
}

async function assertAuthenticatedBenchmarkReady(context, baseUrl) {
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}/dashboard?preview=1`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    })

    const finalPathname = new URL(page.url()).pathname
    if (finalPathname === '/login' || finalPathname === '/auth') {
      throw new Error(
        'Authenticated performance storage state did not unlock /dashboard.'
      )
    }
  } finally {
    await page.close()
  }
}

async function main() {
  assertRouteCoverage()
  rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })

  const appPort = externalBaseUrl ? requestedAppPort : await findAvailablePort(requestedAppPort)
  const chromePort = await findAvailablePort(requestedChromePort)
  const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${appPort}`
  const server = externalBaseUrl
    ? null
    : spawnCommand(bin('next'), ['start', '-p', String(appPort)])
  const failures = []

  console.log(`Lighthouse target: ${baseUrl}`)

  try {
    await waitForServer(baseUrl)

    if (!reusePerfStorageState || !existsSync(perfStorageStatePath)) {
      await ensurePerfStorageState({
        baseUrl,
        storageStatePath: perfStorageStatePath,
      })
    }

    const context = await chromium.launchPersistentContext(chromeUserDataDir, {
      headless: true,
      args: [`--remote-debugging-port=${chromePort}`],
    })

    try {
      await applyStorageStateToContext({
        context,
        storageStatePath: perfStorageStatePath,
        baseUrl,
      })
      await assertAuthenticatedBenchmarkReady(context, baseUrl)

      const detailRoutes = importantOnly ? [] : await resolveDetailRoutes(context, baseUrl)

      for (const route of [...routes, ...detailRoutes]) {
        assertV3Route(route)
        const url = `${baseUrl}${route.path}`
        const result = await lighthouse(url, {
          port: chromePort,
          output: 'json',
          onlyCategories: ['performance'],
          logLevel: 'error',
          formFactor: 'desktop',
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
        })

        if (!result) {
          failures.push({
            route: route.path,
            metric: 'lighthouse',
            actual: 'no result',
            budget: 'valid report',
          })
          continue
        }

        const { lhr, report } = result
        const safeRoute = route.path.slice(1).replace(/\W+/g, '-') || 'root'
        writeFileSync(resolve(outputDir, `${safeRoute}.json`), report)

        if (lhr.runtimeError) {
          failures.push({
            route: route.path,
            metric: 'runtime error',
            actual: lhr.runtimeError.code,
            budget: 'valid Lighthouse run',
          })
          continue
        }

        const finalPathname = new URL(lhr.finalUrl).pathname
        if (route.requiresAuth && finalPathname === '/login') {
          failures.push({
            route: route.path,
            metric: 'authenticated route',
            actual: finalPathname,
            budget: route.expectedPathname ?? route.path,
          })
          continue
        }

        if (route.expectedPathname && finalPathname !== route.expectedPathname) {
          failures.push({
            route: route.path,
            metric: 'final pathname',
            actual: finalPathname,
            budget: route.expectedPathname,
          })
          continue
        }

        const lcp = Math.round(numericAudit(lhr, 'largest-contentful-paint'))
        const cls = Number(numericAudit(lhr, 'cumulative-layout-shift').toFixed(3))
        const tbt = Math.round(numericAudit(lhr, 'total-blocking-time'))
        const scriptKb = resourceKb(lhr, 'script')
        const imageKb = resourceKb(lhr, 'image')
        const totalKb = resourceKb(lhr, 'total')
        const score = Math.round((lhr.categories.performance?.score ?? 0) * 100)

        console.log(
          formatMetricLine(
            route.path,
            score,
            lcp,
            tbt,
            cls,
            scriptKb,
            imageKb,
            totalKb
          )
        )

        assertBudget(
          failures,
          route.path,
          'largest-contentful-paint',
          lcp,
          budgets.largestContentfulPaint
        )
        assertBudget(
          failures,
          route.path,
          'total-blocking-time',
          tbt,
          budgets.totalBlockingTime
        )
        assertBudget(
          failures,
          route.path,
          'cumulative-layout-shift',
          cls,
          budgets.cumulativeLayoutShift,
          ''
        )
        assertBudget(
          failures,
          route.path,
          'script transfer',
          scriptKb,
          budgets.scriptKb,
          'KB'
        )
        assertBudget(
          failures,
          route.path,
          'image transfer',
          imageKb,
          budgets.imageKb,
          'KB'
        )
        assertBudget(
          failures,
          route.path,
          'total transfer',
          totalKb,
          budgets.totalKb,
          'KB'
        )
      }
    } finally {
      await context.close()
    }
  } finally {
    await stopServer(server)
    rmSync(chromeUserDataDir, { recursive: true, force: true })
  }

  if (failures.length) {
    console.error('\nLighthouse budget failures:')
    for (const failure of failures) {
      console.error(
        `- ${failure.route} ${failure.metric}: ${failure.actual} > ${failure.budget}`
      )
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
