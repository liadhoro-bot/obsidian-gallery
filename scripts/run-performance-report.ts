import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const isWindows = process.platform === 'win32'
const skipBuild = process.argv.includes('--skip-build')
const targetUrl = process.env.PERF_BASE_URL ?? 'local production server'
const keepPreviousArtifacts = process.env.PERF_KEEP_ARTIFACTS === '1'
const artifactPaths = [
  '.lighthouseci',
  'playwright-report/performance',
  'test-results',
  '.perf/v3-benchmark',
]

const steps = [
  ...(skipBuild ? [] : [['build', ['run', 'build'], {}] as const]),
  ['lighthouse', ['run', 'perf:lighthouse'], {}] as const,
  ['test', ['run', 'perf:test'], {}] as const,
  [
    'benchmark',
    ['run', 'perf:benchmark'],
    {
      V3_BENCHMARK_SAMPLES: process.env.V3_BENCHMARK_SAMPLES ?? '3',
      V3_BENCHMARK_SCOPE: 'full',
    },
  ] as const,
]

function runStep(name: string, args: readonly string[], extraEnv: Record<string, string>) {
  console.log(`\n=== performance report: ${name} ===`)
  const env = { ...process.env, ...extraEnv }

  const child = isWindows
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
      })
    : spawn('npm', [...args], {
        cwd: process.cwd(),
        env,
        stdio: 'inherit',
      })

  return new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1))
    child.once('error', () => resolve(1))
  })
}

async function main() {
  const failedSteps: string[] = []

  if (!keepPreviousArtifacts) {
    console.log('Performance report artifacts: clearing stale V2/previous-run output')
    for (const artifactPath of artifactPaths) {
      rmSync(resolve(artifactPath), { force: true, recursive: true })
    }
  }

  console.log(`Performance report target: ${targetUrl}`)
  console.log('Performance report scope: V3 published surfaces only')
  if (skipBuild) {
    console.log('Performance report build: skipped')
  }

  for (const [name, args, extraEnv] of steps) {
    const exitCode = await runStep(name, args, extraEnv)
    if (exitCode !== 0) failedSteps.push(name)
  }

  console.log('\n=== performance report: output locations ===')
  console.log('V3 Lighthouse budgets:   .lighthouseci/')
  console.log('V3 Playwright gate:      playwright-report/performance/index.html')
  console.log('V3 Benchmark report:     .perf/v3-benchmark/v3-benchmark-report.md')

  if (failedSteps.length) {
    console.error(`\nPerformance report had failing steps: ${failedSteps.join(', ')}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
