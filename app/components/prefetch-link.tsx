'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  type AnchorHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from 'react'

type PrefetchLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children: ReactNode
  viewportPrefetch?: boolean
  viewportLimit?: number
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

export default function PrefetchLink({
  href,
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
      if (prefetched.has(href)) return
      if (countsAgainstViewportLimit && visiblePrefetchCount >= viewportLimit) {
        return
      }

      prefetched.add(href)
      if (countsAgainstViewportLimit) visiblePrefetchCount += 1

      schedule(() => {
        router.prefetch(href)
      })
    },
    [href, router, viewportLimit]
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
