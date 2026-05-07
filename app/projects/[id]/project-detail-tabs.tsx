import { ProjectDetailTab } from './project-detail-client'

type Props = {
  activeTab: ProjectDetailTab
  setActiveTab: (tab: ProjectDetailTab) => void
}

export default function ProjectDetailTabs({ activeTab, setActiveTab }: Props) {
  const tabs: {
    key: ProjectDetailTab
    label: string
  }[] = [
    { key: 'details', label: 'Project Details' },
    { key: 'units', label: 'Units' },
    { key: 'add', label: 'Add Unit' },
  ]

  return (
    <div className="mt-5 grid grid-cols-3 rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
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
  )
}