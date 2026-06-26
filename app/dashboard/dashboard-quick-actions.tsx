import type { ReactNode } from 'react'
import PrefetchLink from '../components/prefetch-link'
import DashboardQuickActionPaintButton from './dashboard-quick-action-paint-button'
import DashboardQuickActionStartButton from './dashboard-quick-action-start-button'

type Action = {
  label: string
  href: string
  prefetchHref: string
  description?: string
  icon: ReactNode
}

const actionClass =
  'tap-card group relative flex min-h-[90px] flex-col items-center justify-center overflow-hidden rounded-xl border border-cyan-300/45 bg-black/45 p-3 text-center shadow-[0_0_18px_rgba(34,211,238,0.14)] transition hover:border-cyan-200/80 hover:bg-cyan-300/[0.08] hover:shadow-[0_0_28px_rgba(34,211,238,0.24)]'

const iconClass = 'h-7 w-7 text-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]'

function FigurineIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.25a2.45 2.45 0 1 1 0 4.9 2.45 2.45 0 0 1 0-4.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8.6 10.2h6.8l.95 5.35-2.25 1.25.55 3.7h-5.3l.55-3.7-2.25-1.25.95-5.35Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M6.75 20.5h10.5M9.35 12.8l-2.45.95M14.65 12.8l2.45.95"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12.1 3.5c-5 0-8.6 3.35-8.6 7.95 0 3.95 3.05 7.05 7.05 7.05h1.4c.9 0 1.35-.95.9-1.7-.45-.8.1-1.8 1.05-1.8h1.65c2.95 0 4.95-2.05 4.95-4.8 0-3.85-3.35-6.7-8.4-6.7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M7.9 10.15h.02M10.45 7.55h.02M14.15 7.65h.02M16.35 10.6h.02"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  )
}

function PaintVaultIcon() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 9.5h14v10H5v-10Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 9.5V7.35c0-2.05 1.65-3.7 4-3.7s4 1.65 4 3.7V9.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8.2 13.4h7.6M8.2 16.1h4.6M17 13.4v2.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

export default function DashboardQuickActions() {
  const actions: Action[] = [
    {
      label: 'Get Inspired',
      href: '/themes?tab=find',
      prefetchHref: '/themes',
      icon: <PaletteIcon />,
    },
  ]

  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.32em] text-white/60">
        Quick Actions
      </p>

      <div className="grid grid-cols-3 gap-3">
        <DashboardQuickActionStartButton className={actionClass}>
          <span className="pointer-events-none absolute inset-0 bg-cyan-300/[0.03] opacity-0 transition group-hover:opacity-100" />
          <FigurineIcon />
          <span className="relative mt-3 text-[11px] font-bold leading-tight text-white">
            Start Project / Unit
          </span>
        </DashboardQuickActionStartButton>

        {actions.map((action) => (
          <PrefetchLink
            key={action.label}
            href={action.href}
            prefetchHref={action.prefetchHref}
            className={actionClass}
            aria-label={
              action.description
                ? `${action.label}. ${action.description}`
                : action.label
            }
          >
            <span className="pointer-events-none absolute inset-0 bg-cyan-300/[0.03] opacity-0 transition group-hover:opacity-100" />
            {action.icon}
            <span className="relative mt-3 text-[11px] font-bold leading-tight text-white">
              {action.label}
            </span>
          </PrefetchLink>
        ))}

        <DashboardQuickActionPaintButton className={actionClass}>
          <span className="pointer-events-none absolute inset-0 bg-cyan-300/[0.03] opacity-0 transition group-hover:opacity-100" />
          <PaintVaultIcon />
          <span className="relative mt-3 text-[11px] font-bold leading-tight text-white">
            Build Your Collection
          </span>
        </DashboardQuickActionPaintButton>
      </div>
    </section>
  )
}
