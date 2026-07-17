'use client'

import type { ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

type ActiveTab = 'profile' | 'painting-table'

type DashboardTabSwitcherProps = {
  initialTab: ActiveTab
  profilePanel: ReactNode
  paintingTablePanel: ReactNode
}

const tabs: {
  key: ActiveTab
  label: string
}[] = [
  { key: 'profile', label: 'My Progress' },
  {
    key: 'painting-table',
    label: 'Active Units',
  },
]

export default function DashboardTabSwitcher({
  initialTab,
  profilePanel,
  paintingTablePanel,
}: DashboardTabSwitcherProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const currentTab =
    requestedTab === 'profile' || requestedTab === 'painting-table'
      ? requestedTab
      : initialTab

  function navigate(nextTab: ActiveTab) {
    if (nextTab === currentTab) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    const href = `${pathname}?${params.toString()}`

    window.history.replaceState(null, '', href)
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
        {profilePanel}
      </div>

      <div
        hidden={currentTab !== 'painting-table'}
        aria-hidden={currentTab !== 'painting-table'}
      >
        {paintingTablePanel}
      </div>
    </>
  )
}
