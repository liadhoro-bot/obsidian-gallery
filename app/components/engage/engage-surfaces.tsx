'use client'

import Image from 'next/image'
import type { RenderedMessage } from '../../../lib/engage/types'
import dialogStyles from '../../../src/components/v3/surfaces/og-dialog.module.css'
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

// One photo per popup, chosen by message. Same art as onboarding.
const POPUP_IMAGES: Record<string, { src: string; position?: string }> = {
  push_opt_in_popup: { src: '/onboarding/welcome-hero.jpeg' },
  push_opt_in_return_popup: { src: '/onboarding/pains/pile-of-shame.jpeg' },
  session_next_step_popup: { src: '/onboarding/problem-desk.jpeg' },
  saved_guide_assign_popup: { src: '/onboarding/pains/scheme-loss.jpeg' },
}

// The app's dialog (OgDialog's look: parchment panel, brass-ruled title,
// italic line, photo, brass button, ebonized close). Drawn here rather than
// through OgDialog itself so the admin phone mock can hold it in place.
export function PopupView({
  message,
  onAct,
  onDismiss,
  busy = false,
  error = null,
  modal = true,
}: SurfaceProps & { modal?: boolean }) {
  const image = POPUP_IMAGES[message.key]
  return (
    <div
      className={dialogStyles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div
        className={dialogStyles.panel}
        role="dialog"
        aria-modal={modal ? 'true' : undefined}
        aria-labelledby={modal ? 'engage-popup-title' : undefined}
        data-engage={message.key}
      >
        <button type="button" className={dialogStyles.close} aria-label="Not now" onClick={onDismiss}>
          <CloseIcon />
        </button>
        <div className={dialogStyles.scroll}>
          <header className={dialogStyles.head}>
            <h2 id={modal ? 'engage-popup-title' : undefined} className={dialogStyles.title}>
              {message.title}
            </h2>
            {message.isPreview ? <span className={styles.previewBadge}>Preview</span> : null}
            <p className={dialogStyles.subtitle}>{message.body}</p>
          </header>
          {image ? (
            <div className={dialogStyles.imageMount}>
              <Image
                src={image.src}
                alt=""
                fill
                sizes="(max-width: 520px) 92vw, 460px"
                className={dialogStyles.image}
                style={image.position ? { objectPosition: image.position } : undefined}
              />
            </div>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.action}
              data-variant="primary"
              onClick={onAct}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? 'Turning on…' : message.ctaLabel}
            </button>
            <button type="button" className={dialogStyles.action} data-variant="secondary" onClick={onDismiss}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
