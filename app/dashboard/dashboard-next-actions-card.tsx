'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  OgCaption,
  OgIconButton,
  OgObjectTitle,
  SurfacePanel,
} from '@/src/components/v3'
import { capturePostHog } from '../../utils/analytics/client'
import type { DashboardNextActionsState } from './dashboard-data'
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
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const [completionOverrides, setCompletionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map())
  const [isPending, startTransition] = useTransition()
  const isActionDone = (action: DashboardNextActionsState['actions'][number]) =>
    completionOverrides.get(action.id) ?? Boolean(action.completedAt)
  const completedCount = state.actions.filter((action) =>
    isActionDone(action)
  ).length

  if (hidden) {
    return null
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

  function toggleAction(actionId: string) {
    const action = state.actions.find((current) => current.id === actionId)
    const nextDone = action ? !isActionDone(action) : true
    setCompletionOverrides((current) => {
      const next = new Map(current)
      next.set(actionId, nextDone)
      return next
    })

    startTransition(async () => {
      const result = await setDashboardNextActionDone(actionId, nextDone)

      if (!result.ok) {
        setCompletionOverrides((current) => {
          const next = new Map(current)
          next.set(actionId, !nextDone)
          return next
        })
        return
      }

      const isBatchComplete =
        nextDone &&
        state.actions.every((currentAction) =>
          currentAction.id === actionId ? true : isActionDone(currentAction)
        )

      if (isBatchComplete) {
        router.refresh()
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
                data-complete={isActionDone(action)}
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
          const isDone = isActionDone(action)

          return (
            <div key={action.id} className={styles.actionRow}>
              <button
                type="button"
                onClick={() => toggleAction(action.id)}
                className={styles.checkButton}
                data-done={isDone}
                disabled={isPending}
                aria-pressed={isDone}
                aria-label={
                  isDone
                    ? `Mark ${action.label} incomplete`
                    : `Mark ${action.label} complete`
                }
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
                onClick={() => {
                  void capturePostHog('dashboard_next_action_go_clicked', {
                    action_id: action.id,
                    milestone_key: action.milestoneKey,
                    is_done: isDone,
                  })
                }}
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

