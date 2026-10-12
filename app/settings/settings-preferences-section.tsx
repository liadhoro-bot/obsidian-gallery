'use client'

import { useState, useTransition, type CSSProperties } from 'react'
import type { StartupPage } from '../../lib/startup-page'
import { updateStartupPage } from './settings-actions'
import styles from '../settings-support-silver.module.css'

const startupPages: Array<{ id: StartupPage; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: '/icons/nav/dashboard-active.svg' },
  { id: 'projects', label: 'Projects', icon: '/icons/nav/projects-active.svg' },
  { id: 'paints', label: 'Paints', icon: '/icons/nav/vault-active.svg' },
  { id: 'guides', label: 'Guides', icon: '/icons/nav/recipes-active.svg' },
  { id: 'community', label: 'Community', icon: '/icons/nav/community-active.svg' },
]

export default function SettingsPreferencesSection({
  initialStartupPage,
}: {
  initialStartupPage: StartupPage
}) {
  const [startupPage, setStartupPage] = useState(initialStartupPage)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  function chooseStartupPage(nextPage: StartupPage) {
    if (nextPage === startupPage || isSaving) return

    const previousPage = startupPage
    setStartupPage(nextPage)
    setError(null)

    startSaving(async () => {
      const result = await updateStartupPage(nextPage)

      if (result.error) {
        setStartupPage(previousPage)
        setError(result.error)
      }
    })
  }

  const activeLabel = startupPages.find((page) => page.id === startupPage)?.label

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>⌂</span>
        Startup Page
      </h2>

      <p className={styles.description}>
        Choose the page the installed app opens first.
      </p>

      <div className={styles.toggleGrid} aria-label="Startup page">
        {startupPages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => chooseStartupPage(page.id)}
            aria-pressed={startupPage === page.id}
            disabled={isSaving}
            className={[
              styles.toggleItem,
              startupPage === page.id ? styles.toggleItemActive : '',
            ].join(' ')}
          >
            <span
              className={styles.startupNavIcon}
              style={{ '--startup-nav-icon': `url(${page.icon})` } as CSSProperties}
              aria-hidden="true"
            />
            <span className="block w-full truncate text-center">{page.label}</span>
          </button>
        ))}
      </div>

      <p className={styles.startupStatus} role="status" aria-live="polite">
        {error
          ? error
          : isSaving
            ? 'Saving startup page…'
            : `${activeLabel} will open first.`}
      </p>
    </section>
  )
}
