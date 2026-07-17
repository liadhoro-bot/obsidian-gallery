'use client'

import { startTransition, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { prefetchRoute } from '../components/route-prefetch'

type VaultTab = 'find' | 'collection' | 'custom'

type VaultSegmentedTabsProps = {
  activeTab: VaultTab
  q?: string
  brand?: string
  line?: string
  ownership?: string
}

type VaultFilterPreview = {
  q: string
  brand: string
  line: string
  ownership: string
  matchHex: string
  tab: 'find' | 'collection'
}

const tabs: {
  key: VaultTab
  label: string
}[] = [
  { key: 'collection', label: 'My Collection' },
  { key: 'find', label: 'Find Paint' },
  { key: 'custom', label: 'Create Custom' },
]

function buildHref(tab: VaultTab) {
  const searchParams = new URLSearchParams()

  searchParams.set('tab', tab)

  return `/vault?${searchParams.toString()}`
}

export default function VaultSegmentedTabs({
  activeTab,
}: VaultSegmentedTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [optimisticTab, setOptimisticTab] = useState<VaultTab>(activeTab)
  const syncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setOptimisticTab(activeTab)
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current !== null) {
        window.clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    for (const tab of tabs) {
      prefetchRoute(router, buildHref(tab.key))
    }
  }, [router])

  function navigate(nextTab: VaultTab) {
    if (nextTab === optimisticTab && nextTab === activeTab) {
      return
    }

    setOptimisticTab(nextTab)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    params.delete('q')
    params.delete('brand')
    params.delete('line')
    params.delete('ownership')
    params.delete('matchHex')
    params.delete('limit')

    if (nextTab !== 'custom') {
      window.dispatchEvent(
        new CustomEvent<VaultFilterPreview>('vault:filters-preview', {
          detail: {
            q: '',
            brand: '',
            line: '',
            ownership: nextTab === 'collection' ? 'owned' : 'all',
            matchHex: '',
            tab: nextTab,
          },
        })
      )
    }

    const href = `${pathname}?${params.toString()}`
    window.history.replaceState(null, '', href)

    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      syncTimeoutRef.current = null
      startTransition(() => {
        router.replace(href, { scroll: false })
      })
    }, 90)
  }

  return (
    <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
      {tabs.map((tab) => {
        const isActive = optimisticTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(tab.key)}
            className={[
              'rounded-xl px-2 py-3 text-center text-xs font-black transition',
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
  )
}
