'use client'

import { useCallback, useEffect, useSyncExternalStore, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { hasV3PreviewDocumentCookie, isV3PreviewValue } from '../../lib/v3-preview'
import { prefetchRoute } from './route-prefetch'

const navItems = [
  { name: 'Home', href: '/dashboard', icon: '/icons/nav/dashboard.svg' },
  { name: 'Projects', href: '/projects', icon: '/icons/nav/projects.svg' },
  { name: 'Paints', href: '/paints', icon: '/icons/nav/vault.svg' },
  { name: 'Guides', href: '/guides', icon: '/icons/nav/recipes.svg' },
  { name: 'Themes', href: '/themes', icon: '/icons/nav/themes.svg' },
]

function subscribeToUrlChanges(callback: () => void) {
  window.addEventListener('popstate', callback)

  return () => {
    window.removeEventListener('popstate', callback)
  }
}

function getPreviewSnapshot() {
  return (
    isV3PreviewValue(new URLSearchParams(window.location.search).get('preview')) ||
    hasV3PreviewDocumentCookie(document.cookie)
  )
}

function getPreviewServerSnapshot() {
  return false
}

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isPreview = useSyncExternalStore(
    subscribeToUrlChanges,
    getPreviewSnapshot,
    getPreviewServerSnapshot
  )
  const shouldHide =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/settings/terms')

  const getNavHref = useCallback(
    (href: string) => (isPreview ? `${href}?preview=1` : href),
    [isPreview]
  )

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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#061018]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-md items-center justify-around px-2">
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
              className={`nav-pill tap-press tap-target flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl ${
                isActive ? 'text-cyan-400' : 'text-slate-500'
              } ${isPending && isActive ? 'opacity-100' : ''}`}
            >
              <span
                className="nav-pill-icon h-6 w-6 bg-current"
                style={{
                  maskImage: `url(${item.icon})`,
                  WebkitMaskImage: `url(${item.icon})`,
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                }}
              />

              <span className="text-[8px] font-bold uppercase tracking-[0.14em]">
                {item.name}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
