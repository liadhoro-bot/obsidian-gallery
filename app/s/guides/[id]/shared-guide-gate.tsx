'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './shared-guide.module.css'

export type SharedGuideGateVariant = 'login' | 'trial' | 'subscribe'

type SharedGuideGateProps = {
  guideId: string
  variant: SharedGuideGateVariant
}

const copy = {
  login: {
    trigger: 'Log in',
    title: "You're viewing a shared guide",
    body: "You're not logged in to Obsidian Gallery. Log in to save this guide and paint along, or try the app to build your own.",
  },
  trial: {
    trigger: 'Start free trial',
    title: 'Start your free trial',
    body: 'Your account can view this shared guide. Start your 14-day free trial to save it, paint along, and use the rest of Obsidian Gallery.',
  },
  subscribe: {
    trigger: 'Subscribe',
    title: 'Subscribe to unlock the app',
    body: 'Your account can view this shared guide. Subscribe to save it, paint along, and use the rest of Obsidian Gallery.',
  },
} as const

function dismissedKey(guideId: string) {
  return `og-shared-guide-dismissed:${guideId}`
}

// The visitor sees the guide first; the dialog opens after mount. Closing it
// is remembered for the browser session so moving between the guide page and
// its card viewer doesn't reopen it. The trigger pill reopens it any time.
export default function SharedGuideGate({ guideId, variant }: SharedGuideGateProps) {
  const [open, setOpen] = useState(false)
  const text = copy[variant]
  const inAppPath = `/guides/${guideId}?preview=1`
  const loginHref = `/login?next=${encodeURIComponent(inAppPath)}&preview=1`
  const subscribeHref = `/subscribe?next=${encodeURIComponent(inAppPath)}`
  const trialHref = `/trial?next=${encodeURIComponent(inAppPath)}`

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = window.sessionStorage.getItem(dismissedKey(guideId)) === '1'
    } catch {}
    if (dismissed) return
    const timer = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(timer)
  }, [guideId])

  const close = useCallback(() => {
    setOpen(false)
    try {
      window.sessionStorage.setItem(dismissedKey(guideId), '1')
    } catch {}
  }, [guideId])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, close])

  return (
    <>
      <button type="button" className={styles.triggerPill} onClick={() => setOpen(true)}>
        {text.trigger}
      </button>

      {open ? (
        <div className={styles.backdrop} onClick={close}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-guide-gate-title"
            className={styles.dialog}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={styles.closeButton} aria-label="Close" onClick={close}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
            <h2 id="shared-guide-gate-title" className={styles.dialogTitle}>{text.title}</h2>
            <p className={styles.dialogBody}>{text.body}</p>
            <div className={styles.dialogActions}>
              {variant === 'login' ? (
                <>
                  <a href={loginHref} className={styles.primaryAction}>Log in</a>
                  <a href="/onboarding" className={styles.secondaryAction}>Try the app</a>
                </>
              ) : variant === 'trial' ? (
                <a href={trialHref} className={styles.primaryAction}>Start free trial</a>
              ) : (
                <a href={subscribeHref} className={styles.primaryAction}>Subscribe</a>
              )}
            </div>
            <button type="button" className={styles.keepReading} onClick={close}>
              Keep reading this guide
            </button>
          </section>
        </div>
      ) : null}
    </>
  )
}
