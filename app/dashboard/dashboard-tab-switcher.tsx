'use client'

import type { ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import styles from './dashboard-og.module.css'

type ActiveTab = 'profile' | 'painting-table'

type DashboardTabSwitcherProps = {
  initialTab: ActiveTab
  profilePanel: ReactNode
  paintingTablePanel: ReactNode
  nextActionsPanel?: ReactNode
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
  nextActionsPanel,
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
      <div className={styles.tabSurface} role="tablist" aria-label="Dashboard sections">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              onClick={() => navigate(tab.key)}
              aria-selected={isActive}
              className={styles.tabButton}
              data-active={isActive}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {nextActionsPanel}

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
