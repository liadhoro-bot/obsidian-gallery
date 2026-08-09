'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { OgButton, OgCaption, SurfacePanel } from '@/src/components/v3'
import PrefetchLink from '../components/prefetch-link'
import styles from './dashboard-og.module.css'

export default function DashboardQuickActionStartButton({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const [showStartOptions, setShowStartOptions] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowStartOptions(true)}
        className={className}
      >
        {children}
      </button>

      {showStartOptions ? (
        <div
          className={styles.dialogBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Start Project or Unit"
          onClick={() => setShowStartOptions(false)}
        >
          <SurfacePanel
            className={styles.dialogPanel}
            density="default"
            elevation="contact"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <OgCaption>Start</OgCaption>
              <OgButton
                type="button"
                onClick={() => setShowStartOptions(false)}
                size="compact"
                variant="tertiary"
              >
                Close
              </OgButton>
            </div>

            <div className={styles.dialogGrid}>
              <PrefetchLink
                href="/projects?tab=create"
                prefetchHref="/projects"
                className={styles.dialogOption}
              >
                Project
              </PrefetchLink>
              <PrefetchLink
                href="/units/new"
                prefetchHref="/units/new"
                className={styles.dialogOption}
              >
                Unit
              </PrefetchLink>
            </div>
          </SurfacePanel>
        </div>
      ) : null}
    </>
  )
}
