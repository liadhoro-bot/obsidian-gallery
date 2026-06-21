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
import { isPrefetchableHref, prefetchRoute } from './route-prefetch'

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

let visiblePrefetchCount = 0

type Router = ReturnType<typeof useRouter>

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
  viewportLimit = 2,
  onMouseEnter,
  onFocus,
  className,
  ...props
}: PrefetchLinkProps) {
  const router = useRouter()
  const ref = useRef<HTMLAnchorElement | null>(null)

  const prefetch = useCallback(
    (countsAgainstViewportLimit: boolean) => {
      if (!isPrefetchableHref(prefetchHref)) {
        return
      }

      if (countsAgainstViewportLimit && visiblePrefetchCount >= viewportLimit) {
        return
      }

      const didPrefetch = prefetchRoute(router, prefetchHref)
      if (countsAgainstViewportLimit && didPrefetch) visiblePrefetchCount += 1
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
      className={['tap-card', className].filter(Boolean).join(' ')}
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
  className,
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
      className={['tap-press tap-target', className].filter(Boolean).join(' ')}
    />
  )
}
