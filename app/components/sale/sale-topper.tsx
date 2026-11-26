'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { OgTopper } from '@/src/components/v3'
import { SALE, isSaleActive } from '@/lib/subscription/sale'
import { openUpgradePrompt } from '../upgrade/upgrade-prompt'
import styles from './sale-topper.module.css'

// Black Friday banner at the top of the app. Shown to signed-in users
// without Premium until the sale ends; SAVE NOW opens the upgrade dialog,
// which goes straight on to the Grow checkout.

const DISMISS_KEY = 'og-sale-black-friday-2026-dismissed'

const HIDDEN_PREFIXES = [
  '/login',
  '/auth',
  '/onboarding',
  '/offline',
  '/support',
  '/settings/terms',
  '/s/',
  '/payment-success',
  '/paint-mode',
  '/guides/decks',
  '/admin',
]

// One status check per page load, shared by every route change.
let premiumCheck: Promise<boolean> | null = null
function hasPremium() {
  premiumCheck ??= fetch('/api/subscription/status', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : { isActive: true }))
    .then((status: { isActive?: boolean }) => status.isActive !== false)
    .catch(() => true)
  return premiumCheck
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function SaleTopper() {
  const pathname = usePathname()
  const [eligible, setEligible] = useState(false)
  // Client-only component (ClientShell loads it with ssr: false), so
  // localStorage is readable on the first render.
  const [dismissed, setDismissed] = useState(readDismissed)

  useEffect(() => {
    if (!isSaleActive() || dismissed) return
    if (!document.cookie.includes('-auth-token')) return
    let cancelled = false
    hasPremium().then((premium) => {
      if (!cancelled) setEligible(!premium)
    })
    return () => {
      cancelled = true
    }
    // Only on mount: dismissing just hides the banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hiddenHere =
    pathname === '/' || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!eligible || dismissed || hiddenHere || !isSaleActive()) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  return (
    <div className={styles.slot}>
      <OgTopper
        title={`${SALE.name} Sale ends ${SALE.endsLabel}`}
        subtitle={<>Premium for <span className={styles.price}>₪{SALE.priceIls}</span>/month for {SALE.months} months.</>}
        cta={{ label: 'SAVE NOW', onClick: () => openUpgradePrompt() }}
        onDismiss={dismiss}
        dismissLabel="Hide the Black Friday sale"
      />
    </div>
  )
}
