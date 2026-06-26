import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { resolve } from 'node:path'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'
import {
  applyStorageStateToContext,
  ensurePerfStorageState,
} from './perf-auth-utils.mjs'

const routes = [
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
] 

const budgets = {
  largestContentfulPaint: 2500,
  cumulativeLayoutShift: 0.1,
  totalBlockingTime: 200,
  scriptKb: 250,
  imageKb: 600,
  totalKb: 1200,
}

const isWindows = process.platform === 'win32'
const requestedAppPort = Number(process.env.PERF_LIGHTHOUSE_APP_PORT ?? 3100)
const requestedChromePort = Number(process.env.PERF_LIGHTHOUSE_CHROME_PORT ?? 9229)
const outputDir = resolve('.lighthouseci')
const perfStorageStatePath = resolve(
  process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-lighthouse.json'
)
const hasPerfStorageState = Boolean(
  perfStorageStatePath && existsSync(perfStorageStatePath)
)
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
      const response = await fetch(`${baseUrl}/login`, { redirect: 'manual' })
      if (response.status > 0) return
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`Lighthouse server did not become ready: ${String(lastError)}`)
}

async function stopServer(server) {
  if (!server.pid || server.exitCode !== null) return

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

function formatMetricLine(route, score, lcp, tbt, cls, scriptKb, imageKb, totalKb) {
  return [
    route.padEnd(16),
    `score=${String(score).padStart(3)}`,
    `LCP=${String(lcp).padStart(4)}ms`,
    `TBT=${String(tbt).padStart(4)}ms`,
    `CLS=${cls}`,
    `JS=${scriptKb}KB`,
    `IMG=${imageKb}KB`,
    `TOTAL=${totalKb}KB`,
  ].join('  ')
}

async function resolveProtectedDetailRoutes(context, baseUrl) {
  const page = await context.newPage()

  try {
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle' })

    const projectRoute = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
      const match = links
        .map((link) => link.getAttribute('href'))
        .find((href) => typeof href === 'string' && /^\/projects\/[^/?#]+$/.test(href))

      return match ?? null
    })

    if (!projectRoute) {
      return []
    }

    await page.goto(`${baseUrl}${projectRoute}`, { waitUntil: 'networkidle' })

    const unitRoute = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
      const match = links
        .map((link) => link.getAttribute('href'))
        .find((href) => typeof href === 'string' && /^\/units\/[^/?#]+$/.test(href))

      return match ?? null
    })

    return [
      { path: projectRoute, requiresAuth: true },
      ...(unitRoute ? [{ path: unitRoute, requiresAuth: true }] : []),
    ]
  } finally {
    await page.close()
  }
}

async function main() {
  mkdirSync(outputDir, { recursive: true })

  const appPort = await findAvailablePort(requestedAppPort)
  const chromePort = await findAvailablePort(requestedChromePort)
  const baseUrl = `http://127.0.0.1:${appPort}`
  const server = spawnCommand(bin('next'), ['start', '-p', String(appPort)])
  const failures = []
  const skippedRoutes = []

  try {
    await waitForServer(baseUrl)

    if (!hasPerfStorageState) {
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

      const detailRoutes = await resolveProtectedDetailRoutes(context, baseUrl)

      for (const route of [...routes, ...detailRoutes]) {
        if (route.requiresAuth && !existsSync(perfStorageStatePath)) {
          skippedRoutes.push(route.path)
          console.log(`${route.path.padEnd(16)} skipped  missing PERF_STORAGE_STATE`)
          continue
        }

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
          skippedRoutes.push(route.path)
          console.log(
            `${route.path.padEnd(16)} skipped  redirected to /login; configure PERF_STORAGE_STATE`
          )
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

  if (skippedRoutes.length) {
    console.error('\nSkipped Lighthouse routes:')
    for (const route of skippedRoutes) {
      console.error(`- ${route}`)
    }
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
