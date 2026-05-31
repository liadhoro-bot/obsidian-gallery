const isPerfDebugEnabled =
  process.env.PERF_DEBUG === 'true' || process.env.NEXT_PUBLIC_PERF_DEBUG === 'true'

export function createPerfTimer(route: string) {
  const enabled = isPerfDebugEnabled || process.env.NODE_ENV === 'development'
  const start = performance.now()
  let last = start

  return {
    mark(label: string) {
      if (!enabled) return

      const now = performance.now()
      console.log(
        `[perf:${route}] ${label} ${(now - last).toFixed(1)}ms (+${(now - start).toFixed(1)}ms total)`
      )
      last = now
    },
    total() {
      if (!enabled) return

      const now = performance.now()
      console.log(`[perf:${route}] total ${(now - start).toFixed(1)}ms`)
    },
  }
}
