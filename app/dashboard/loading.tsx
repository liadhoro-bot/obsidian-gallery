import { WorkbenchShell } from '@/src/components/v3'
import styles from './dashboard-og.module.css'

export default function DashboardLoading() {
  return (
    <WorkbenchShell
      contentClassName={styles.dashboardFrame}
      gutter="none"
      maxWidth="var(--og-workbench-compact-max-width)"
    >
      <div className={styles.loadingShell} aria-label="Loading dashboard">
        <div className={styles.loadingHeader}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingLine} />
          <span className={styles.loadingButton} />
        </div>

        <div className={styles.loadingTabs}>
          <span />
          <span />
        </div>

        <section className={styles.loadingPanel}>
          <span className={styles.loadingLine} />
          <span className={styles.loadingTrack} />
        </section>

        <section className={styles.loadingPanel} data-kind="featured">
          <span className={styles.loadingLine} />
          <span className={styles.loadingTrack} />
          <span className={styles.loadingPhoto} />
        </section>
      </div>
    </WorkbenchShell>
  )
}
