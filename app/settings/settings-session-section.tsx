import { logout } from './settings-actions'
import SubmitButton from '../components/SubmitButton'
import styles from '../settings-support-silver.module.css'

export default async function SettingsSessionSection() {
  return (
    <section className={styles.sessionSection}>
      <div className={styles.sessionTextBlock}>
        <h2 className={styles.sectionTitle}>
          Session Management
        </h2>
        <p className={styles.muted}>
          You are currently logged in.
        </p>
      </div>

      <form action={logout}>
        <SubmitButton
          idleText="Logout"
          pendingText="Logging out..."
          className={styles.dangerButton}
        />
      </form>
    </section>
  )
}
