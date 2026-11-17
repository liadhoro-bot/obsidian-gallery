'use client'

import {
  describePushStatus,
  usePushNotifications,
} from '../../lib/push/use-push-notifications'
import styles from '../settings-support-silver.module.css'

export default function SettingsNotificationsSection() {
  const push = usePushNotifications()

  return (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>🔔</span>
        Notifications
      </h2>

      <p className={styles.description} role="status" aria-live="polite">
        {push.error ?? describePushStatus(push.status)}
      </p>

      {push.status === 'off' ? (
        <button
          type="button"
          className={styles.primaryButton}
          onClick={push.enable}
          disabled={push.busy}
        >
          {push.busy ? 'Turning on…' : 'Turn on notifications'}
        </button>
      ) : null}

      {push.status === 'on' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={push.sendTest}
            disabled={push.busy}
          >
            Send test
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={push.disable}
            disabled={push.busy}
          >
            Turn off
          </button>
        </div>
      ) : null}
    </section>
  )
}
