'use client'

import Link from '@/app/components/navigation-feedback/navigation-link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PlanSummary } from '../../lib/subscription/billing'
import styles from '../settings-support-silver.module.css'

type CancelState = 'idle' | 'confirming' | 'cancelling' | 'done' | 'error'

export default function SettingsPlanCard({ plan }: { plan: PlanSummary }) {
  const router = useRouter()
  const [cancelState, setCancelState] = useState<CancelState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function confirmCancel() {
    setCancelState('cancelling')
    setMessage(null)

    try {
      const response = await fetch('/api/subscription/cancel', { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        setCancelState('error')
        setMessage(payload?.error ?? 'Could not cancel right now. Try again in a moment.')
        return
      }

      setCancelState('done')
      setMessage('Your plan is cancelled. You will not be charged again.')
      router.refresh()
    } catch {
      setCancelState('error')
      setMessage('Could not reach the server. Check your connection and try again.')
    }
  }

  return (
    <section className={`${styles.panel} ${styles.previewPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelLabel}>Plan</h2>
      </div>

      <div className={styles.previewSectionBody}>
        <div className={styles.planHeadline}>
          <h3 className={`${styles.previewName} truncate`}>{plan.label}</h3>
          <span
            className={[
              styles.badge,
              plan.badge === 'Active' || plan.badge === 'Trial' || plan.badge === 'Staff'
                ? ''
                : styles.badgeMuted,
            ].join(' ')}
          >
            {plan.badge}
          </span>
        </div>

        <dl className={styles.planRows}>
          <div>
            <dt className={styles.planRowLabel}>Payment plan</dt>
            <dd className={styles.planRowValue}>{plan.priceLabel}</dd>
          </div>
          <div>
            <dt className={styles.planRowLabel}>Status</dt>
            <dd className={styles.planRowValue}>{plan.detail}</dd>
          </div>
        </dl>

        {plan.subscribeLabel ? (
          <Link href="/subscribe?upgrade=1&next=%2Fsettings" className={styles.walnutButton}>
            {plan.subscribeLabel}
          </Link>
        ) : null}

        {plan.canCancel && (cancelState === 'idle' || cancelState === 'error') ? (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={() => setCancelState('confirming')}
          >
            Cancel plan
          </button>
        ) : null}

        {plan.canCancel && (cancelState === 'confirming' || cancelState === 'cancelling') ? (
          <div className={styles.planConfirm}>
            <p className={styles.linkDescription}>
              Cancel your monthly plan? You won&apos;t be charged again, and you
              keep full access until the end of the period you already paid for.
            </p>
            <div className={styles.buttonGrid}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={cancelState === 'cancelling'}
                onClick={() => setCancelState('idle')}
              >
                Keep plan
              </button>
              <button
                type="button"
                className={`${styles.dangerButton} ${styles.planConfirmDanger}`}
                disabled={cancelState === 'cancelling'}
                onClick={confirmCancel}
              >
                {cancelState === 'cancelling' ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={[
              cancelState === 'error' ? styles.messageError : styles.messageSuccess,
              styles.planMessage,
            ].join(' ')}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
