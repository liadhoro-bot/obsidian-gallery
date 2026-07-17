type RouterWithPrefetch = {
  prefetch: (href: string) => void
}

type PrefetchPriority = 'idle' | 'immediate'

const prefetched = new Set<string>()
const queue: (() => void)[] = []
let scheduled = false

function schedule(task: () => void) {
  queue.push(task)
  scheduleDrain()
}

function scheduleDrain() {
  if (scheduled) return

  scheduled = true
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number
  }

  const run = () => {
    scheduled = false
    drainQueue()
  }

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(run, { timeout: 1200 })
    return
  }

  window.setTimeout(run, 250)
}

function drainQueue() {
  const task = queue.shift()
  if (!task) return

  task()

  if (queue.length > 0) {
    scheduleDrain()
  }
}

export function isPrefetchableHref(href: string) {
  return href.startsWith('/') && !href.startsWith('//')
}

export function prefetchRoute(
  router: RouterWithPrefetch,
  href: string,
  options?: {
    priority?: PrefetchPriority
  }
) {
  if (!isPrefetchableHref(href) || prefetched.has(href)) return false

  prefetched.add(href)
  const runPrefetch = () => {
    router.prefetch(href)
  }

  if (options?.priority === 'immediate') {
    runPrefetch()
    return true
  }

  schedule(runPrefetch)

  return true
}
