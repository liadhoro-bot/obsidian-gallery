'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react'

type PrefetchLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  prefetchHref?: string
  children: ReactNode
  viewportPrefetch?: boolean
  viewportLimit?: number
}

type PrefetchButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  prefetchHref: string
}

const prefetched = new Set<string>()
let visiblePrefetchCount = 0
let inFlight = 0
const queue: (() => void)[] = []

function schedule(task: () => void) {
  queue.push(task)
  drainQueue()
}

function drainQueue() {
  if (inFlight >= 2) return

  const task = queue.shift()
  if (!task) return

  inFlight += 1
  task()
  window.setTimeout(() => {
    inFlight -= 1
    drainQueue()
  }, 250)
}

type Router = ReturnType<typeof useRouter>

function isPrefetchableHref(href: string) {
  return href.startsWith('/') && !href.startsWith('//')
}

export function prefetchRoute(router: Router, href: string) {
  if (!isPrefetchableHref(href) || prefetched.has(href)) return

  prefetched.add(href)
  schedule(() => {
    router.prefetch(href)
  })
}

export function useRoutePrefetch(href: string) {
  const router = useRouter()

  return useCallback(() => {
    prefetchRoute(router, href)
  }, [href, router])
}

export default function PrefetchLink({
  href,
  prefetchHref = href,
  children,
  viewportPrefetch = false,
  viewportLimit = 6,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter()
  const ref = useRef<HTMLAnchorElement | null>(null)

  const prefetch = useCallback(
    (countsAgainstViewportLimit: boolean) => {
      if (!isPrefetchableHref(prefetchHref) || prefetched.has(prefetchHref)) {
        return
      }

      if (countsAgainstViewportLimit && visiblePrefetchCount >= viewportLimit) {
        return
      }

      prefetched.add(prefetchHref)
      if (countsAgainstViewportLimit) visiblePrefetchCount += 1

      schedule(() => {
        router.prefetch(prefetchHref)
      })
    },
    [prefetchHref, router, viewportLimit]
  )

  useEffect(() => {
    if (!viewportPrefetch || !ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          prefetch(true)
          observer.disconnect()
        }
      },
      { rootMargin: '160px 0px' }
    )

    observer.observe(ref.current)

    return () => observer.disconnect()
  }, [prefetch, viewportPrefetch])

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        prefetch(false)
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        prefetch(false)
        onFocus?.(event)
      }}
      onTouchStart={(event) => {
        prefetch(false)
        onTouchStart?.(event)
      }}
      {...props}
    >
      {children}
    </Link>
  )
}

export function PrefetchButton({
  prefetchHref,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: PrefetchButtonProps) {
  const prefetch = useRoutePrefetch(prefetchHref)

  return (
    <button
      {...props}
      onMouseEnter={(event) => {
        prefetch()
        onMouseEnter?.(event)
      }}
      onFocus={(event) => {
        prefetch()
        onFocus?.(event)
      }}
      onTouchStart={(event) => {
        prefetch()
        onTouchStart?.(event)
      }}
    />
  )
}
