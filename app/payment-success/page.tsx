'use client'

import { useEffect } from 'react'

// Must match the string checked in app/subscribe/subscribe-client.tsx.
const PAYMENT_SUCCESS_MESSAGE = 'obsidian-gallery:grow-payment-success'

// This is the page Grow's "Success URL" points to. It only ever loads
// inside the payment popup window, so all it has to do is tell the main
// tab payment succeeded and close itself. It does not check anything
// itself — the real source of truth is the Grow webhook -> Make ->
// Supabase write, which happens independently of this page loading.
export default function PaymentSuccessPage() {
  useEffect(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(PAYMENT_SUCCESS_MESSAGE, window.location.origin)
      }
    } catch {
      // If the opener is unreachable for any reason, the subscribe page's
      // own polling still picks up the paid status within a few seconds.
    }

    const timer = setTimeout(() => window.close(), 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-center text-white">
      <div>
        <h1 className="text-2xl font-bold">Payment received</h1>
        <p className="mt-2 text-neutral-400">You can close this window.</p>
      </div>
    </main>
  )
}
