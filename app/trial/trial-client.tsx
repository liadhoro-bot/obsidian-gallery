'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from '../subscribe/subscribe-silver.module.css'

export default function TrialClient({ nextPath }: { nextPath: string }) {
  const [isStarting, setIsStarting] = useState(false)
  const [message, setMessage] = useState('')

  async function startTrial() {
    setIsStarting(true)
    setMessage('')

    try {
      const response = await fetch('/api/trial/start', {
        method: 'POST',
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as
        | { endsAt?: string; error?: string }
        | null

      if (!response.ok || !payload?.endsAt) {
        setIsStarting(false)
        setMessage(payload?.error ?? 'Could not start your trial. Try again.')
        return
      }
    } catch {
      setIsStarting(false)
      setMessage('Could not reach the server. Check your connection and try again.')
      return
    }

    // Full navigation so the proxy re-reads access with the new trial.
    window.location.assign(nextPath)
  }

  return (
    <div>
      <button
        type="button"
        onClick={startTrial}
        disabled={isStarting}
        className={`tap-press tap-target ${styles.ctaGold}`}
      >
        {isStarting ? 'Starting your trial...' : 'Start free trial'}
      </button>

      <p className={styles.secureNote}>
        <span>
          By starting your trial you agree to our{' '}
          <Link href="/settings/terms" className={styles.termsLink}>
            Terms
          </Link>
        </span>
      </p>

      {message ? <p className={styles.statusMessage}>{message}</p> : null}
    </div>
  )
}
