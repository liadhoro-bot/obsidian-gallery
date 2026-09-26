'use client'

import { createContext, useCallback, useContext, useMemo, useState, useTransition, useOptimistic, type ReactNode } from 'react'
import { useRouter as useNextRouter } from 'next/navigation'
import LoadingSurface from './loading-surface'
import styles from './navigation-feedback.module.css'

type Router = ReturnType<typeof useNextRouter>
type PendingLink = { id: symbol; href: string }
type NavigationContextValue = {
  href: string | null
  router: Router
  showLink: (link: PendingLink) => void
  clearLink: (id: symbol) => void
}
const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const nextRouter = useNextRouter()
  const [, startTransition] = useTransition()
  const [destination, setDestination] = useOptimistic<string | null>(null)
  const [link, setLink] = useState<PendingLink | null>(null)
  const showLink = useCallback((value: PendingLink) => setLink(value), [])
  const clearLink = useCallback((id: symbol) => setLink(current => current?.id === id ? null : current), [])
  const router = useMemo<Router>(() => {
    const navigate = (method: 'push' | 'replace', href: string, options?: Parameters<Router['push']>[1]) => {
      const next = new URL(href, window.location.href)
      const current = new URL(window.location.href)
      if (next.origin !== current.origin || (next.hash !== current.hash && next.pathname === current.pathname && next.search === current.search)) {
        nextRouter[method](href, options)
        return
      }
      setLink(null)
      startTransition(() => {
        setDestination(href)
        nextRouter[method](href, options)
      })
    }
    return { ...nextRouter, push: (href, options) => navigate('push', href, options), replace: (href, options) => navigate('replace', href, options) }
  }, [nextRouter, setDestination])
  const href = destination ?? link?.href ?? null
  const value = useMemo(() => ({ href, router, showLink, clearLink }), [href, router, showLink, clearLink])
  return <NavigationContext.Provider value={value}>
    {children}
    {href ? <div className={styles.overlay} data-navigation-overlay>
      <LoadingSurface href={href} onDashboardTab={tab => {
        const url = new URL(href, window.location.href)
        url.searchParams.set('tab', tab)
        router.replace(`${url.pathname}${url.search}`, { scroll: false })
      }} />
    </div> : null}
  </NavigationContext.Provider>
}

export function NavigationContent({ children }: { children: ReactNode }) {
  const pending = Boolean(useContext(NavigationContext)?.href)
  return <div style={{ display: 'contents' }} inert={pending} aria-hidden={pending || undefined}>{children}</div>
}

export function useNavigationFeedback() { return useContext(NavigationContext) }

// Refresh, prefetch and history semantics remain owned by Next. Mutations keep
// their local pending UI; only destination navigation gets a page skeleton.
export function useRouter(): Router {
  const fallback = useNextRouter()
  return useContext(NavigationContext)?.router ?? fallback
}
