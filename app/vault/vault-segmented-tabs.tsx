import Link from 'next/link'

type VaultTab = 'find' | 'collection' | 'custom'

type VaultSegmentedTabsProps = {
  activeTab: VaultTab
  q?: string
  brand?: string
  line?: string
  ownership?: string
}

function buildHref(tab: VaultTab) {
  const searchParams = new URLSearchParams()

  searchParams.set('tab', tab)

  return `/vault?${searchParams.toString()}`
}

export default function VaultSegmentedTabs({
  activeTab,
  q,
  brand,
  line,
  ownership,
}: VaultSegmentedTabsProps) {
  const tabs: {
    key: VaultTab
    label: string
  }[] = [
    { key: 'find', label: 'Find Color' },
    { key: 'collection', label: 'My Collection' },
    { key: 'custom', label: 'Custom Color' },
  ]

  return (
    <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <Link
            key={tab.key}
            href={buildHref(tab.key)}
            className={[
              'rounded-xl px-2 py-3 text-center text-xs font-black transition',
              isActive
                ? 'bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                : 'text-white/45 hover:bg-white/5 hover:text-white/75',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}