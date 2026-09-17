'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './subscribe-silver.module.css'

// Must match the string posted from app/payment-success/page.tsx.
const PAYMENT_SUCCESS_MESSAGE = 'obsidian-gallery:grow-payment-success'
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 120000

type Status = 'idle' | 'creating' | 'waiting' | 'error'

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 6.5l8 6.5 8-6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 19.5c1.2-3.4 4-5 7-5s5.8 1.6 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4.5h3l1.4 4-2 1.6a11 11 0 0 0 5.5 5.5l1.6-2 4 1.4v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 6.7 2 2 0 0 1 6 4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export default function SubscribeClient({
  email,
  nextPath,
}: {
  email: string
  nextPath: string
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pollRef.current = null
    timeoutRef.current = null
  }, [])

  const finishAsPaid = useCallback(() => {
    stopPolling()
    popupRef.current?.close()
    window.location.assign(nextPath)
  }, [nextPath, stopPolling])

  const startPolling = useCallback(() => {
    setStatus('waiting')
    setMessage('Waiting for payment confirmation...')

    pollRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/subscription/status', { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { isActive?: boolean }
        if (data.isActive) {
          finishAsPaid()
        }
      } catch {
        // A transient network hiccup shouldn't stop the flow; just keep polling.
      }
    }, POLL_INTERVAL_MS)

    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setStatus('error')
      setMessage(
        "Payment is taking a while to confirm. If you completed payment, refresh this page in a minute — it'll let you in as soon as it's confirmed."
      )
    }, POLL_TIMEOUT_MS)
  }, [finishAsPaid, stopPolling])

  // Fast path: the payment-success page (loaded inside the popup) posts a
  // message the moment Grow redirects there. The polling above is the
  // fallback in case the popup gets closed, blocked, or the message doesn't
  // arrive for some reason.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data === PAYMENT_SUCCESS_MESSAGE) {
        finishAsPaid()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [finishAsPaid])

  useEffect(() => stopPolling, [stopPolling])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('creating')
    setMessage('')

    let response: Response
    try {
      response = await fetch('/api/subscription/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() }),
      })
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Check your connection and try again.')
      return
    }

    const payload = (await response.json().catch(() => null)) as
      | { paymentUrl?: string; error?: string }
      | null

    if (!response.ok || !payload?.paymentUrl) {
      setStatus('error')
      setMessage(payload?.error ?? 'Could not start the payment. Try again.')
      return
    }

    const popup = window.open(
      payload.paymentUrl,
      'growPayment',
      'width=480,height=760'
    )

    if (!popup) {
      setStatus('error')
      setMessage('Your browser blocked the payment popup. Allow popups for this site and try again.')
      return
    }

    popupRef.current = popup
    startPolling()
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className={styles.formLight}>
        <div>
          <label className={styles.fieldLabel}>Email</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>
              <MailIcon />
            </span>
            <input
              type="email"
              value={email}
              disabled
              className={styles.inputLight}
            />
          </div>
        </div>

        <div>
          <label className={styles.fieldLabel}>Full name</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>
              <PersonIcon />
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              minLength={3}
              autoComplete="name"
              className={styles.inputLight}
              placeholder="First Last"
            />
          </div>
        </div>

        <div>
          <label className={styles.fieldLabel}>Mobile phone</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>
              <PhoneIcon />
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              pattern="0\d{8,9}"
              autoComplete="tel"
              inputMode="numeric"
              className={styles.inputLight}
              placeholder="0501234567"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'creating' || status === 'waiting'}
          className={`tap-press tap-target ${styles.ctaGold}`}
        >
          {status === 'creating'
            ? 'Opening payment...'
            : status === 'waiting'
              ? 'Waiting for payment...'
              : "Claim my Founder's Pass - ₪15"}
        </button>
      </form>

      <p className={styles.secureNote}>
        <LockIcon />
        Secure checkout on the next screen
      </p>

      {message ? <p className={styles.statusMessage}>{message}</p> : null}
    </div>
  )
}
