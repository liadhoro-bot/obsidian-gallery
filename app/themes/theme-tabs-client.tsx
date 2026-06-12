'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

const tabs = [
  { key: 'find', label: 'Find Theme' },
  { key: 'mine', label: 'My Themes' },
  { key: 'create', label: 'Create Theme' },
]

type Props = {
  activeTab: string
}

export default function ThemeTabsClient({ activeTab }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const currentTab = searchParams.get('tab') || activeTab
  const [optimisticTab, setOptimisticTab] = useState(currentTab)

  useEffect(() => {
    setOptimisticTab(currentTab)
  }, [currentTab])

  function setTab(tab: string) {
    setOptimisticTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    startTransition(() => {
      router.push(`/themes?${params.toString()}`)
    })
  }

  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setTab(tab.key)}
          className={tabClass(optimisticTab === tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function tabClass(active: boolean) {
  return [
    'rounded-lg px-2 py-3 text-xs font-semibold transition',
    active
      ? 'border border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
      : 'text-white/60',
  ].join(' ')
}
