'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type ActiveTab = 'profile' | 'painting-table'

type DashboardTabSwitcherProps = {
  initialTab: ActiveTab
  profilePanel: ReactNode | null
  paintingTablePanel: ReactNode | null
}

const tabs: {
  key: ActiveTab
  label: string
}[] = [
  { key: 'profile', label: 'My Stats' },
  {
    key: 'painting-table',
    label: 'Painting Table',
  },
]

export default function DashboardTabSwitcher({
  initialTab,
  profilePanel,
  paintingTablePanel,
}: DashboardTabSwitcherProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const currentTab =
    requestedTab === 'profile' || requestedTab === 'painting-table'
      ? requestedTab
      : initialTab

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', currentTab === 'profile' ? 'painting-table' : 'profile')
    const href = `${pathname}?${params.toString()}`
    let timeoutId: number | null = null
    let idleId: number | null = null
    const prefetchInactiveTab = () => router.prefetch(href)

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(prefetchInactiveTab, {
        timeout: 1500,
      })
    } else {
      timeoutId = window.setTimeout(prefetchInactiveTab, 500)
    }

    return () => {
      if (idleId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [currentTab, pathname, router, searchParams])

  function navigate(nextTab: ActiveTab) {
    if (nextTab === currentTab) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    const href = `${pathname}?${params.toString()}`

    router.replace(href, { scroll: false })
  }

  return (
    <>
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(tab.key)}
              aria-pressed={isActive}
              className={[
                'rounded-xl px-2 py-3 text-center text-xs font-black transition active:scale-[0.98] active:opacity-70',
                isActive
                  ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'text-white/45 hover:bg-white/5 hover:text-white/75',
              ].join(' ')}
            >
              <span className="relative inline-flex items-center justify-center">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      <div
        hidden={currentTab !== 'profile'}
        aria-hidden={currentTab !== 'profile'}
      >
        {currentTab === 'profile' ? profilePanel : null}
      </div>

      <div
        hidden={currentTab !== 'painting-table'}
        aria-hidden={currentTab !== 'painting-table'}
      >
        {currentTab === 'painting-table' ? paintingTablePanel : null}
      </div>
    </>
  )
}
