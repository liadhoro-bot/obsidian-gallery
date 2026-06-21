'use client'

import { useState } from 'react'

type DashboardTabsProps = {
  profileContent: React.ReactNode
  paintingTableContent: React.ReactNode
}

type ActiveTab = 'profile' | 'painting-table'

export default function DashboardTabs({
  profileContent,
  paintingTableContent,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('painting-table')

  const tabs: {
    key: ActiveTab
    label: string
  }[] = [
    { key: 'profile', label: 'My Stats' },
    { key: 'painting-table', label: 'Painting Table' },
  ]

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-xl px-2 py-3 text-center text-xs font-black transition active:scale-[0.98] active:opacity-70',
                isActive
                  ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'text-white/45 hover:bg-white/5 hover:text-white/75',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' ? profileContent : paintingTableContent}
    </div>
  )
}
