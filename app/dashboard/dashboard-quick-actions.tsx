import PrefetchLink from '../components/prefetch-link'

const actions = [
  {
    label: 'Add Paint',
    href: '/vault?newPaint=1',
    prefetchHref: '/vault',
    icon: '✚',
    color: 'text-cyan-400',
  },
  {
    label: 'New Recipe',
    href: '/recipes?newRecipe=1',
    prefetchHref: '/recipes',
    icon: '▤',
    color: 'text-orange-400',
  },
  {
    label: 'Add Model',
    href: '/projects',
    prefetchHref: '/projects',
    icon: '▣',
    color: 'text-yellow-300',
  },
]

export default function DashboardQuickActions() {
  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60">
        Quick Actions
      </p>

      <div className="grid grid-cols-3 gap-3">
        {actions.map((action) => (
          <PrefetchLink
            key={action.label}
            href={action.href}
            prefetchHref={action.prefetchHref}
            className="flex min-h-[78px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center transition hover:border-cyan-400/40 hover:bg-white/[0.09]"
          >
            <span className={`text-xl font-black ${action.color}`}>
              {action.icon}
            </span>
            <span className="mt-3 text-[11px] font-bold text-white">
              {action.label}
            </span>
          </PrefetchLink>
        ))}
      </div>
    </section>
  )
}
