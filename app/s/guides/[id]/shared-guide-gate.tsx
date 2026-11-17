'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './shared-guide.module.css'

type SharedGuideGateProps = {
  guideId: string
}

const text = {
  trigger: 'Log in',
  title: "You're viewing a shared guide",
  body: "You're not logged in to Obsidian Gallery. Log in to save this guide and paint along, or join free to build your own.",
} as const

function dismissedKey(guideId: string) {
  return `og-shared-guide-dismissed:${guideId}`
}

// The visitor sees the guide first; the dialog opens after mount. Closing it
// is remembered for the browser session so moving between the guide page and
// its card viewer doesn't reopen it. The trigger pill reopens it any time.
export default function SharedGuideGate({ guideId }: SharedGuideGateProps) {
  const [open, setOpen] = useState(false)
  const inAppPath = `/guides/${guideId}?preview=1`
  const loginHref = `/login?next=${encodeURIComponent(inAppPath)}&preview=1`

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
              <a href={loginHref} className={styles.primaryAction}>Log in</a>
              <a href="/onboarding" className={styles.secondaryAction}>Join free</a>
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
