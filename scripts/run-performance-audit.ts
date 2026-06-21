import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'

const steps = [
  ['build', ['run', 'build']],
  ['lighthouse', ['run', 'perf:lighthouse']],
  ['flows', ['run', 'perf:flows']],
] as const

function runStep(name: string, args: readonly string[]) {
  console.log(`\n=== performance audit: ${name} ===`)

  const child = isWindows
    ? spawn('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })
    : spawn('npm', [...args], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })

  return new Promise<number>((resolve) => {
    child.once('exit', (code) => resolve(code ?? 1))
    child.once('error', () => resolve(1))
  })
}

async function main() {
  const failedSteps: string[] = []

  for (const [name, args] of steps) {
    const exitCode = await runStep(name, args)
    if (exitCode !== 0) failedSteps.push(name)
  }

  if (failedSteps.length) {
    console.error(`\nPerformance audit failed: ${failedSteps.join(', ')}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
