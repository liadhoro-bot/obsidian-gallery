'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import {
  OgCaption,
  OgIconButton,
  OgObjectTitle,
  SurfacePanel,
} from '@/src/components/v3'
import type {
  DashboardNextActionItem,
  DashboardNextActionsState,
} from './dashboard-data'
import {
  dismissDashboardNextActions,
  setDashboardNextActionDone,
} from './actions'
import styles from './dashboard-og.module.css'

type Props = {
  state: DashboardNextActionsState
}

function SparkIcon() {
  return (
    <span className={styles.actionGlyph}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
        <path
          d="M13.4 2.75 5.9 12.2h5.2l-1.3 9.05 8.3-10.65h-5.35l.65-7.85Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  )
}

function BreadcrumbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M5 7.5h5v5H5v-5ZM14 7.5h5v5h-5v-5ZM5 16h5v.5H5V16ZM14 16h5v.5h-5V16Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.2 4.1L19 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M5 12h12M13 7l5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export default function DashboardNextActionsCard({ state }: Props) {
  const [hidden, setHidden] = useState(false)
  const [completedIds, setCompletedIds] = useState(
    () => new Set(state.actions.filter((action) => action.completedAt).map((action) => action.id))
  )
  const [isPending, startTransition] = useTransition()

  const completedCount = useMemo(
    () => state.actions.filter((action) => completedIds.has(action.id)).length,
    [completedIds, state.actions]
  )

  if (hidden) {
    return null
  }

  function toggleAction(action: DashboardNextActionItem) {
    const nextDone = !completedIds.has(action.id)
    setCompletedIds((current) => {
      const next = new Set(current)
      if (nextDone) {
        next.add(action.id)
      } else {
        next.delete(action.id)
      }
      return next
    })

    startTransition(async () => {
      const result = await setDashboardNextActionDone(action.id, nextDone)

      if (!result.ok) {
        setCompletedIds((current) => {
          const next = new Set(current)
          if (nextDone) {
            next.delete(action.id)
          } else {
            next.add(action.id)
          }
          return next
        })
      }
    })
  }

  function dismiss() {
    setHidden(true)
    startTransition(async () => {
      const result = await dismissDashboardNextActions()

      if (!result.ok) {
        setHidden(false)
      }
    })
  }

  return (
    <SurfacePanel
      aria-label="User next actions"
      className={[styles.nextActionsPanel, isPending ? styles.pending : ''].join(' ')}
      density="default"
      elevation="contact"
    >
      <div className={styles.nextActionsHeader}>
        <div className={styles.nextActionsIdentity}>
          <SparkIcon />

          <div className={styles.sectionTitleBlock}>
            <OgObjectTitle as="h2">{state.title}</OgObjectTitle>
            <OgCaption>
              {completedCount}/{state.totalCount} complete
            </OgCaption>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.progressDots} aria-hidden="true">
            {state.actions.map((action) => (
              <span
                key={action.id}
                className={styles.progressDot}
                data-complete={completedIds.has(action.id)}
              />
            ))}
          </div>

          <OgIconButton label="Dismiss next actions" onClick={dismiss} size="compact">
            <CloseIcon />
          </OgIconButton>
        </div>
      </div>

      <div className={styles.actionRows}>
        {state.actions.map((action) => {
          const isDone = completedIds.has(action.id)

          return (
            <div key={action.id} className={styles.actionRow}>
              <button
                type="button"
                onClick={() => toggleAction(action)}
                aria-pressed={isDone}
                aria-label={
                  isDone
                    ? `Mark ${action.label} incomplete`
                    : `Mark ${action.label} complete`
                }
                className={styles.checkButton}
                data-done={isDone}
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>

              <div className={styles.actionText}>
                <span className={styles.actionTitle} data-done={isDone}>
                  {action.label}
                </span>
                <span className={styles.breadcrumb}>
                  <BreadcrumbIcon />
                  <span className={styles.breadcrumbText}>{action.breadcrumb}</span>
                </span>
              </div>

              <Link
                href={action.href}
                className={styles.actionLink}
                aria-label={`Go to ${action.label}`}
              >
                {isDone ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <span>Go</span>
                    <ArrowIcon />
                  </>
                )}
              </Link>
            </div>
          )
        })}
      </div>
    </SurfacePanel>
  )
}

