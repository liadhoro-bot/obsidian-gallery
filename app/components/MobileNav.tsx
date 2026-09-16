'use client'

import { useCallback, useEffect, useTransition } from 'react'
import type { CSSProperties } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { prefetchRoute } from './route-prefetch'
import styles from './mobile-nav.module.css'

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: '/icons/nav/dashboard.svg',
    activeIcon: '/icons/nav/dashboard-active.svg',
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: '/icons/nav/projects.svg',
    activeIcon: '/icons/nav/projects-active.svg',
  },
  {
    name: 'Paints',
    href: '/paints',
    icon: '/icons/nav/vault.svg',
    activeIcon: '/icons/nav/vault-active.svg',
  },
  {
    name: 'Guides',
    href: '/guides',
    icon: '/icons/nav/recipes.svg',
    activeIcon: '/icons/nav/recipes-active.svg',
  },
  {
    name: 'Community',
    href: '/community',
    icon: '/icons/nav/community.svg',
    activeIcon: '/icons/nav/community-active.svg',
  },
]

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const shouldHide =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/settings/terms') ||
    pathname.startsWith('/guides/decks')

  const getNavHref = useCallback((href: string) => href, [])

  useEffect(() => {
    let cancelled = false
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const warmMainRoutes = () => {
      if (cancelled) {
        return
      }

      for (const item of navItems) {
        if (item.href !== pathname) {
          prefetchRoute(router, getNavHref(item.href))
        }
      }
    }

    let timeoutId: number | null = null
    let idleId: number | null = null

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(warmMainRoutes, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(warmMainRoutes, 250)
    }

    return () => {
      cancelled = true

      if (idleId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId)
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [getNavHref, pathname, router])

  function prefetchNavHref(href: string, priority: 'idle' | 'immediate' = 'idle') {
    if (href !== pathname) {
      prefetchRoute(router, getNavHref(href), { priority })
    }
  }

  function navigate(href: string) {
    if (href === pathname) {
      return
    }

    prefetchNavHref(href, 'immediate')
    startTransition(() => {
      router.push(getNavHref(href))
    })
  }

  if (shouldHide) {
    return null
  }

  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      <div className={styles.inner}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <button
              key={item.href}
              type="button"
              onMouseEnter={() => prefetchNavHref(item.href)}
              onFocus={() => prefetchNavHref(item.href)}
              onTouchStart={() => prefetchNavHref(item.href, 'immediate')}
              onPointerDown={() => prefetchNavHref(item.href, 'immediate')}
              onClick={() => navigate(item.href)}
              data-active={isActive}
              aria-current={isActive ? 'page' : undefined}
              disabled={isPending && isActive}
              className={styles.item}
            >
              <span
                className={styles.icon}
                style={
                  {
                    '--nav-icon': `url(${isActive ? item.activeIcon : item.icon})`,
                  } as CSSProperties
                }
                aria-hidden="true"
              />

              <span className={styles.label}>{item.name}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
