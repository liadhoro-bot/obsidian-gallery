import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { ensurePerfStorageState } from './perf-auth-utils.mjs'

const requestedPort = Number(process.env.PERF_PORT ?? 3103)
const isWindows = process.platform === 'win32'
const externalBaseUrl = process.env.PERF_BASE_URL
const perfStorageStatePath = resolve(
  process.env.PERF_STORAGE_STATE ?? '.perf/perf-storage-state-flows.json'
)
const refreshPerfStorageState = process.env.PERF_REFRESH_STORAGE_STATE === '1'
const authSetupTimeoutMs = Number(process.env.V3_PERF_AUTH_TIMEOUT_MS ?? 90_000)
const testTimeoutMs = Number(process.env.V3_PERF_TEST_TIMEOUT_MS ?? 180_000)

function storageStateMatchesBaseUrl(storageStatePath: string, baseUrl: string) {
  if (!existsSync(storageStatePath)) return false

  try {
    const hostname = new URL(baseUrl).hostname
    const storageState = JSON.parse(readFileSync(storageStatePath, 'utf8')) as {
      cookies?: Array<{ domain?: string; name?: string; value?: string }>
    }
    const authCookie = storageState.cookies?.find(
      (cookie) =>
        cookie.domain === hostname && cookie.name?.endsWith('-auth-token')
    )

    if (!authCookie?.value) return false

    const session = JSON.parse(
      Buffer.from(authCookie.value.replace(/^base64-/, ''), 'base64').toString(
        'utf8'
      )
    ) as { expires_at?: number }
    const expiresAt = session.expires_at ?? 0
    const minimumValidUntil = Math.floor(Date.now() / 1000) + 300

    return expiresAt > minimumValidUntil
  } catch {
    return false
  }
}

function bin(name: string) {
  return `node_modules${isWindows ? '\\' : '/'} .bin`
    .replace(' ', '')
    .concat(`${isWindows ? '\\' : '/'}${name}${isWindows ? '.cmd' : ''}`)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, () => {
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

  throw new Error(`V3 Perf Test server did not become ready: ${String(lastError)}`)
}

function spawnCommand(command: string, args: string[], env = process.env) {
  const commandArgs = isWindows ? ['/c', command, ...args] : args

  return spawn(isWindows ? 'cmd.exe' : command, commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
}

async function stopServer(server: ChildProcess) {
  if (!server.pid || server.exitCode !== null) return

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

async function waitForProcess(
  processName: string,
  childProcess: ChildProcess,
  timeoutMs: number
) {
  return new Promise<number>((resolve) => {
    const timeout = setTimeout(async () => {
      console.error(`${processName} exceeded ${timeoutMs}ms and was stopped.`)
      await stopServer(childProcess)
      resolve(124)
    }, timeoutMs)

    childProcess.once('exit', (code) => {
      clearTimeout(timeout)
      resolve(code ?? 1)
    })
    childProcess.once('error', () => {
      clearTimeout(timeout)
      resolve(1)
    })
  })
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

async function main() {
  console.log('V3 Perf Test')

  const port = externalBaseUrl ? requestedPort : await findAvailablePort(requestedPort)
  const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`
  const server = externalBaseUrl
    ? null
    : spawnCommand(bin('next'), ['start', '-p', String(port)])

  const stopOnSignal = async () => {
    if (server) {
      await stopServer(server)
    }
    process.exit(130)
  }

  process.once('SIGINT', stopOnSignal)
  process.once('SIGTERM', stopOnSignal)

  try {
    await waitForServer(baseUrl)
    const shouldCreateStorageState =
      refreshPerfStorageState ||
      !storageStateMatchesBaseUrl(perfStorageStatePath, baseUrl)

    if (shouldCreateStorageState) {
      console.log(`Creating fresh perf auth state for ${baseUrl}`)
      await withTimeout(
        'V3 Perf Test auth setup',
        ensurePerfStorageState({
          baseUrl,
          storageStatePath: perfStorageStatePath,
        }),
        authSetupTimeoutMs
      )
    } else {
      console.log(`Reusing perf auth state at ${perfStorageStatePath}`)
    }

    const testProcess = spawnCommand(
      bin('playwright'),
      ['test', 'tests/performance/v3-performance.spec.ts', '--reporter=list'],
      {
        ...process.env,
        PERF_BASE_URL: baseUrl,
        PERF_PORT: String(port),
        PERF_STORAGE_STATE: perfStorageStatePath,
        V3_PERF_ALLOW_COLD_SERVER:
          process.env.V3_PERF_ALLOW_COLD_SERVER ?? (externalBaseUrl ? '1' : '0'),
      }
    )

    const exitCode = await waitForProcess(
      'V3 Perf Test',
      testProcess,
      testTimeoutMs
    )

    process.exitCode = exitCode
  } finally {
    if (server) {
      await stopServer(server)
    }
  }

  process.exit(process.exitCode ?? 0)
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
