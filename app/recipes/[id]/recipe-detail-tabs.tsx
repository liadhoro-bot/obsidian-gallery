export type RecipeDetailTab = 'details' | 'steps' | 'edit'

type Props = {
  activeTab: RecipeDetailTab
  setActiveTab: (tab: RecipeDetailTab) => void
  isOwner: boolean
  onRecipeStepsClick?: () => void
}

export default function RecipeDetailTabs({
  activeTab,
  setActiveTab,
  isOwner,
  onRecipeStepsClick,
}: Props) {
  const tabs: {
    key: RecipeDetailTab
    label: string
  }[] = [
    { key: 'details', label: 'Guide Details' },
    { key: 'steps', label: 'Guide Cards' },
  ]

  if (isOwner) {
    tabs.push({ key: 'edit', label: 'Edit Guide' })
  }

  return (
    <div
      className={[
        'mt-5 grid rounded-2xl border border-white/10 bg-slate-950/70 p-1 shadow-[0_0_24px_rgba(34,211,238,0.08)]',
        isOwner ? 'grid-cols-3' : 'grid-cols-2',
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (tab.key === 'steps' && onRecipeStepsClick) {
                onRecipeStepsClick()
                return
              }

              setActiveTab(tab.key)
            }}
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
