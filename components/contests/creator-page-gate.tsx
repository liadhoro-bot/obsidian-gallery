'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from '@/app/s/guides/[id]/shared-guide.module.css'

export type CreatorPageGateVariant = 'login' | 'trial' | 'subscribe'

export type CreatorPageGateProps = {
  variant: CreatorPageGateVariant
  // Where the visitor comes back to after logging in or starting a trial.
  returnPath: string
  creatorName: string
}

function copyFor(variant: CreatorPageGateVariant, creatorName: string, wantsToVote: boolean) {
  if (variant === 'login') {
    return {
      trigger: 'Log in',
      title: wantsToVote ? 'Log in to vote' : "You're viewing a contest entry",
      body: wantsToVote
        ? `Log in to vote for ${creatorName} in the Top Hobby Guides contest. New here? Try the app to start your free trial, then cast your vote.`
        : `This is ${creatorName}'s entry in the Top Hobby Guides contest. Log in to vote, or try the app to start your free trial.`,
    }
  }
  if (variant === 'trial') {
    return {
      trigger: 'Start free trial',
      title: 'Start your free trial to vote',
      body: `Start your 14-day free trial to vote for ${creatorName} and use the rest of Obsidian Gallery.`,
    }
  }
  return {
    trigger: 'Subscribe',
    title: 'Subscribe to vote',
    body: `Your free trial has ended. Subscribe to vote for ${creatorName} and keep using Obsidian Gallery.`,
  }
}

export function CreatorGateDialog({ variant, returnPath, creatorName, wantsToVote = false, onClose }: CreatorPageGateProps & {
  wantsToVote?: boolean
  onClose: () => void
}) {
  const text = copyFor(variant, creatorName, wantsToVote)
  const next = encodeURIComponent(returnPath)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="creator-gate-title" className={styles.dialog}
        onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.closeButton} aria-label="Close" onClick={onClose}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <h2 id="creator-gate-title" className={styles.dialogTitle}>{text.title}</h2>
        <p className={styles.dialogBody}>{text.body}</p>
        <div className={styles.dialogActions}>
          {variant === 'login' ? (
            <>
              <a href={`/login?next=${next}&preview=1`} className={styles.primaryAction}>Log in</a>
              <a href="/onboarding?preview=1" className={styles.secondaryAction}>Try the app</a>
            </>
          ) : variant === 'trial' ? (
            <a href={`/trial?next=${next}`} className={styles.primaryAction}>Start free trial</a>
          ) : (
            <a href={`/subscribe?next=${next}`} className={styles.primaryAction}>Subscribe</a>
          )}
        </div>
        <button type="button" className={styles.keepReading} onClick={onClose}>
          Keep browsing {creatorName}&apos;s guides
        </button>
      </section>
    </div>
  )
}

function dismissedKey(returnPath: string) {
  return `og-creator-gate-dismissed:${returnPath}`
}

// Visitors see the creator page first; the dialog opens after mount. Closing
// it is remembered for the browser session, and the pill reopens it.
export default function CreatorPageGate(props: CreatorPageGateProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = window.sessionStorage.getItem(dismissedKey(props.returnPath)) === '1'
    } catch {}
    if (dismissed) return
    const timer = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(timer)
  }, [props.returnPath])

  const close = useCallback(() => {
    setOpen(false)
    try {
      window.sessionStorage.setItem(dismissedKey(props.returnPath), '1')
    } catch {}
  }, [props.returnPath])

  return (
    <>
      <button type="button" className={styles.triggerPill} onClick={() => setOpen(true)}>
        {copyFor(props.variant, props.creatorName, false).trigger}
      </button>
      {open ? <CreatorGateDialog {...props} onClose={close} /> : null}
    </>
  )
}
