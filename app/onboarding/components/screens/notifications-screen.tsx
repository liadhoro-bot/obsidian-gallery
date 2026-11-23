'use client'

import { useEffect, useRef } from 'react'
import { usePushNotifications } from '../../../../lib/push/use-push-notifications'
import { recordNotificationEvent } from '../../../engage/actions'
import { capturePostHog } from '../../../../utils/analytics/client'
import styles from '../../../auth-flow-silver.module.css'
import { NOTIFICATIONS_COPY, type NotificationsCopyVariant } from './notifications-copy'

type NotificationsScreenProps = {
  onDone: () => void
  /**
   * Admin preview (/admin/onboarding): always render the ask, track nothing,
   * and leave the buttons inert. 'proposed' shows copy waiting for approval.
   */
  preview?: NotificationsCopyVariant
}

const SOURCE = 'onboarding'

/**
 * Soft opt-in for push (ENGAGE framework 6.1). The native browser prompt only
 * appears after the user taps Enable. Only shown when this device can
 * actually ask (Push API available and the user hasn't decided yet);
 * otherwise it passes straight through. iPhone Safari outside the Home
 * Screen app can't ask, so those users skip this and can turn it on later
 * in Settings.
 */
export default function NotificationsScreen({ onDone, preview }: NotificationsScreenProps) {
  const push = usePushNotifications(SOURCE)
  const finished = useRef(false)
  const shownLogged = useRef(false)
  const copy = NOTIFICATIONS_COPY[preview ?? 'live']

  function finish(result: string) {
    if (finished.current) return
    finished.current = true
    void capturePostHog('onboarding_notifications', { result })
    onDone()
  }

  useEffect(() => {
    if (preview) return
    if (push.status === 'off' && !shownLogged.current) {
      shownLogged.current = true
      void recordNotificationEvent('soft_prompt_shown', SOURCE, 'prompt').catch(() => {})
    }
  }, [push.status, preview])

  useEffect(() => {
    if (preview) return
    if (push.status === 'loading' || push.status === 'off') return
    if (push.busy) return
    // 'on' after tapping Turn on, or a device that can't / already decided.
    finish(push.status === 'on' ? 'enabled' : `skipped_${push.status}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push.status, push.busy, preview])

  if (!preview && push.status !== 'off') {
    return <section className={styles.paperScreen} aria-busy="true" />
  }

  return (
    <section className={styles.paperScreen}>
      <div className={styles.stepDots} aria-hidden="true">
        {[0, 1, 2].map((step) => (
          <span key={step} className={`${styles.stepDot} ${styles.stepDotActive}`} />
        ))}
      </div>

      <div className={`${styles.screenIntro} ${styles.screenIntroLarge}`}>
        <h1 className={styles.screenTitle}>{copy.title}</h1>
        {copy.body.map((paragraph) => (
          <p key={paragraph} className={styles.screenCopy}>
            {paragraph}
          </p>
        ))}
      </div>

      {!preview && push.error ? (
        <p className={`${styles.message} ${styles.messageError}`}>{push.error}</p>
      ) : null}

      <div className={styles.bottomActions}>
        <button
          type="button"
          disabled={!preview && push.busy}
          onClick={() => {
            if (preview) return
            void recordNotificationEvent('soft_prompt_enable', SOURCE).catch(() => {})
            void push.enable()
          }}
          className={`tap-press tap-target ${styles.ctaButton}`}
        >
          {!preview && push.busy ? 'Turning on...' : copy.cta}
        </button>

        <button
          type="button"
          disabled={!preview && push.busy}
          onClick={() => {
            if (preview) return
            void recordNotificationEvent('soft_prompt_skipped', SOURCE).catch(() => {})
            finish('declined')
          }}
          className={`tap-target ${styles.backButton}`}
        >
          {copy.skip}
        </button>
      </div>
    </section>
  )
}
