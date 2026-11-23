'use client'

import type { RenderedMessage } from '../../../lib/engage/types'
import dialogStyles from '../upgrade/premium-checkout.module.css'
import styles from './engage.module.css'

// The look of the two in-app ENGAGE surfaces, with no behaviour of their own.
// engage-host wires them to real actions; /admin/engage renders the same
// views inside a phone mock, so what the admin sees is what users get.

type SurfaceProps = {
  message: RenderedMessage
  onAct: () => void
  onDismiss: () => void
  busy?: boolean
  error?: string | null
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

// A one-line strip: title, one button, a close cross. The body copy is for
// popups and pushes only.
export function TopperView({ message, onAct, onDismiss, busy = false, error = null }: SurfaceProps) {
  return (
    <aside className={styles.topper} role="status" aria-live="polite" data-engage={message.key}>
      <p className={styles.topperTitle}>
        {message.title}
        {message.isPreview ? <span className={styles.previewBadge}>Preview</span> : null}
      </p>
      <button type="button" className={`tap-press ${styles.topperCta}`} onClick={onAct} disabled={busy}>
        {busy ? 'Turning on…' : message.ctaLabel}
      </button>
      <button type="button" className={styles.topperClose} aria-label="Not now" onClick={onDismiss}>
        <CloseIcon />
      </button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </aside>
  )
}

export function PopupView({
  message,
  onAct,
  onDismiss,
  busy = false,
  error = null,
  modal = true,
}: SurfaceProps & { modal?: boolean }) {
  return (
    <div className={dialogStyles.backdrop} onClick={onDismiss}>
      <section
        role="dialog"
        aria-modal={modal ? 'true' : undefined}
        aria-labelledby={modal ? 'engage-popup-title' : undefined}
        className={dialogStyles.dialog}
        onClick={(event) => event.stopPropagation()}
        data-engage={message.key}
      >
        <button type="button" className={dialogStyles.closeButton} aria-label="Close" onClick={onDismiss}>
          <CloseIcon />
        </button>
        <p className={dialogStyles.eyebrow}>
          Obsidian Gallery
          {message.isPreview ? <span className={styles.previewBadge}>Preview</span> : null}
        </p>
        <h2 id={modal ? 'engage-popup-title' : undefined} className={dialogStyles.title}>
          {message.title}
        </h2>
        <p className={dialogStyles.body}>{message.body}</p>
        {error ? <p className={dialogStyles.body}>{error}</p> : null}
        <button type="button" className={`tap-press tap-target ${dialogStyles.ctaGold}`} onClick={onAct} disabled={busy}>
          {busy ? 'Turning on…' : message.ctaLabel}
        </button>
        <button type="button" className={dialogStyles.notNow} onClick={onDismiss}>
          Not now
        </button>
      </section>
    </div>
  )
}
