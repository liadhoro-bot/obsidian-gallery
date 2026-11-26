'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import {
  PLAN_LIMIT_URL_PARAMS,
  PREMIUM_PRICE_ILS,
  describePlanLimitHit,
  isPlanLimitHit,
  planLimitFromSearchParams,
  type PlanLimitHit,
} from '@/lib/plan/limit-types'
import { SALE, isSaleActive } from '@/lib/subscription/sale'
import PremiumCheckoutForm from './premium-checkout-form'
import styles from './premium-checkout.module.css'

// One upgrade dialog for the whole app. Anything that gets a PlanLimitHit
// back from the server calls openUpgradePrompt(hit); Settings calls it with
// no hit. <UpgradePromptHost /> (mounted once in ClientShell) renders it.

type PromptState = { open: false } | { open: true; hit: PlanLimitHit | null; id: number }

let state: PromptState = { open: false }
let openCount = 0
const listeners = new Set<() => void>()

function setState(next: PromptState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function openUpgradePrompt(hit: PlanLimitHit | null = null) {
  openCount += 1
  setState({ open: true, hit, id: openCount })
}

/**
 * For fetch/action results: opens the prompt and returns true when the
 * payload carries a plan limit hit ({ limit: PlanLimitHit }).
 */
export function openUpgradePromptFor(payload: unknown) {
  const hit = (payload as { limit?: unknown } | null | undefined)?.limit
  if (!isPlanLimitHit(hit)) return false
  openUpgradePrompt(hit)
  return true
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state
const CLOSED: PromptState = { open: false }
const getServerSnapshot = () => CLOSED

function CloseIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function UpgradeDialog({ hit, onClose }: { hit: PlanLimitHit | null; onClose: () => void }) {
  const [step, setStep] = useState<'offer' | 'checkout'>('offer')
  const [email, setEmail] = useState('')
  const [alreadyPremium, setAlreadyPremium] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/subscription/status', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { email?: string; isActive?: boolean } | null) => {
        if (cancelled || !data) return
        setEmail(data.email ?? '')
        setAlreadyPremium(Boolean(data.isActive))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const [onSale] = useState(() => isSaleActive())
  const title = hit ?'Time to upgrade your workbench' : 'Upgrade to Premium'
  const body = alreadyPremium
    ? 'Your account is already on Premium. Refresh the page and try again.'
    : hit
      ? `${describePlanLimitHit(hit)} You have ${hit.used}. Upgrade to Premium to go past the free plan's limits.`
      : "Premium lifts the free plan's limits on projects, units and your paint collection."

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-prompt-title"
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <p className={styles.eyebrow}>{hit
          ? 'Free plan limit reached'
          : onSale
            ? `${SALE.name} · ends ${SALE.endsLabel}`
            : 'Obsidian Gallery Premium'}</p>
        <h2 id="upgrade-prompt-title" className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>

        {alreadyPremium ? null : (
          <>
            <div className={styles.planCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className={styles.planIcon} />
              <div className={styles.planText}>
                <span className={styles.planName}>Premium</span>
                <span className={styles.planNote}>
                  {onSale
                    ? `For ${SALE.months} months`
                    : 'Billed monthly · cancel anytime in Settings'}
                </span>
              </div>
              <span className={styles.planPrice}>
                {onSale ? <s className={styles.planPriceWas}>₪{PREMIUM_PRICE_ILS}</s> : null}
                ₪{onSale ? SALE.priceIls : PREMIUM_PRICE_ILS}<small>/mo</small>
              </span>
            </div>

            {step === 'offer' ? (
              <button
                type="button"
                className={`tap-press tap-target ${styles.ctaGold}`}
                onClick={() => setStep('checkout')}
              >
                Upgrade to Premium
              </button>
            ) : (
              <PremiumCheckoutForm email={email} />
            )}
          </>
        )}

        <button type="button" className={styles.notNow} onClick={onClose}>
          {hit ? 'Not now' : 'Close'}
        </button>
      </section>
    </div>
  )
}

export function UpgradePromptHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const close = useCallback(() => setState({ open: false }), [])
  const pathname = usePathname()

  // Redirecting server actions pass the hit as ?plan_limit=… (see
  // planLimitSearchParams). Open the prompt, then tidy the URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const hit = planLimitFromSearchParams(url.searchParams)
    if (!hit) return
    PLAN_LIMIT_URL_PARAMS.forEach((param) => url.searchParams.delete(param))
    window.history.replaceState(window.history.state, '', url.toString())
    openUpgradePrompt(hit)
  }, [pathname])

  if (!current.open) return null
  return <UpgradeDialog key={current.id} hit={current.hit} onClose={close} />
}
