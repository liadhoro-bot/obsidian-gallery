import type { ReactNode } from 'react'
import { OgCaption } from '@/src/components/v3'
import PrefetchLink from '../components/prefetch-link'
import DashboardQuickActionPaintButton from './dashboard-quick-action-paint-button'
import DashboardQuickActionStartButton from './dashboard-quick-action-start-button'
import styles from './dashboard-og.module.css'

type Action = {
  label: string
  href: string
  prefetchHref: string
  description?: string
  icon: ReactNode
}

function FigurineIcon() {
  return (
    <svg className={styles.quickActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg className={styles.quickActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg className={styles.quickActionIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <section className={styles.quickActions}>
      <OgCaption>Quick Actions</OgCaption>

      <div className={styles.quickActionGrid}>
        <DashboardQuickActionStartButton className={styles.quickAction}>
          <FigurineIcon />
          <span className={styles.quickActionLabel}>Start Project / Unit</span>
        </DashboardQuickActionStartButton>

        {actions.map((action) => (
          <PrefetchLink
            key={action.label}
            href={action.href}
            prefetchHref={action.prefetchHref}
            className={styles.quickAction}
            aria-label={
              action.description
                ? `${action.label}. ${action.description}`
                : action.label
            }
          >
            {action.icon}
            <span className={styles.quickActionLabel}>{action.label}</span>
          </PrefetchLink>
        ))}

        <DashboardQuickActionPaintButton className={styles.quickAction}>
          <PaintVaultIcon />
          <span className={styles.quickActionLabel}>Build Your Collection</span>
        </DashboardQuickActionPaintButton>
      </div>
    </section>
  )
}
