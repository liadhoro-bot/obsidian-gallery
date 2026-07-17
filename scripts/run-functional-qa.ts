import net from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { ensurePerfStorageState } from './perf-auth-utils.mjs'

const requestedPort = Number(process.env.QA_PORT ?? 3202)
const isWindows = process.platform === 'win32'
const qaStorageStatePath = resolve(
  process.env.QA_STORAGE_STATE ?? '.qa/functional-storage-state.json'
)

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
  const deadline = Date.now() + 45_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`, { redirect: 'manual' })
      if (response.status > 0) return
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`Functional QA server did not become ready: ${String(lastError)}`)
}

function spawnCommand(command: string, args: string[], env = process.env) {
  const commandArgs = isWindows ? ['/c', command, ...args] : args

  return spawn(isWindows ? 'cmd.exe' : command, commandArgs, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  })
}

async function waitForExit(process: ChildProcess) {
  return new Promise<number>((resolve) => {
    process.once('exit', (code) => resolve(code ?? 1))
    process.once('error', () => resolve(1))
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

async function main() {
  if (process.env.QA_SKIP_BUILD !== '1') {
    const buildProcess = spawnCommand(bin('next'), ['build'])
    const buildExitCode = await waitForExit(buildProcess)
    if (buildExitCode !== 0) {
      process.exit(buildExitCode)
    }
  }

  const port = await findAvailablePort(requestedPort)
  const baseUrl = process.env.QA_BASE_URL ?? `http://127.0.0.1:${port}`
  const server = spawnCommand(bin('next'), ['start', '-p', String(port)])

  const stopOnSignal = async () => {
    await stopServer(server)
    process.exit(130)
  }

  process.once('SIGINT', stopOnSignal)
  process.once('SIGTERM', stopOnSignal)

  try {
    await waitForServer(baseUrl)
    await ensurePerfStorageState({
      baseUrl,
      storageStatePath: qaStorageStatePath,
      userDataDir: resolve('.qa', 'auth-browser-profile'),
    })

    const testProcess = spawnCommand(
      bin('playwright'),
      ['test', '--config=playwright.functional.config.ts'],
      {
        ...process.env,
        QA_BASE_URL: baseUrl,
        QA_PORT: String(port),
        QA_STORAGE_STATE: qaStorageStatePath,
      }
    )

    process.exitCode = await waitForExit(testProcess)
  } finally {
    await stopServer(server)
  }

  process.exit(process.exitCode ?? 0)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
