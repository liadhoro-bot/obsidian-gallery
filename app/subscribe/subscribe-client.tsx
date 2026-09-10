'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Must match the string posted from app/payment-success/page.tsx.
const PAYMENT_SUCCESS_MESSAGE = 'obsidian-gallery:grow-payment-success'
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 120000

type Status = 'idle' | 'creating' | 'waiting' | 'error'

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
    <div className="mt-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-neutral-300">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-neutral-300">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            minLength={3}
            autoComplete="name"
            className="min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            placeholder="First Last"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-neutral-300">Mobile phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            pattern="0\d{8,9}"
            autoComplete="tel"
            inputMode="numeric"
            className="min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            placeholder="0501234567"
          />
        </div>

        <button
          type="submit"
          disabled={status === 'creating' || status === 'waiting'}
          className="tap-press tap-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
        >
          {status === 'creating'
            ? 'Opening payment...'
            : status === 'waiting'
              ? 'Waiting for payment...'
              : 'Pay & unlock the app'}
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-neutral-300">{message}</p> : null}
    </div>
  )
}
