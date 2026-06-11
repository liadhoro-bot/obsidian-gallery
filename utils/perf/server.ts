const isPerfDebugEnabled =
  process.env.PERF_DEBUG === 'true' || process.env.NEXT_PUBLIC_PERF_DEBUG === 'true'

export function createPerfTimer(route: string) {
  const enabled = isPerfDebugEnabled
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
    async measure<T>(label: string, work: () => Promise<T>) {
      if (!enabled) return work()

      const markStart = performance.now()
      try {
        return await work()
      } finally {
        const now = performance.now()
        console.log(
          `[perf:${route}] ${label} ${(now - markStart).toFixed(1)}ms (+${(now - start).toFixed(1)}ms total)`
        )
        last = now
      }
    },
  }
}

export async function measureServerAction<T>(
  actionName: string,
  work: (perf: ReturnType<typeof createPerfTimer>) => Promise<T>
) {
  const perf = createPerfTimer(`action:${actionName}`)

  try {
    return await work(perf)
  } finally {
    perf.total()
  }
}
