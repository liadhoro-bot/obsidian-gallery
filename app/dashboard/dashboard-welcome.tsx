import { OgPageTitle, OgSubtitle } from '@/src/components/v3'
import styles from './dashboard-og.module.css'

export default function DashboardWelcome() {
  return (
    <section className={styles.welcome}>
      <OgPageTitle className={styles.welcomeTitle}>Welcome, Painter</OgPageTitle>
      <OgSubtitle className={styles.welcomeSubtitle}>
        Are you ready to slay some grey today?
      </OgSubtitle>
    </section>
  )
}
