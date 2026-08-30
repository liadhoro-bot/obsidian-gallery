import { safeEvaluateAchievements } from '../../lib/achievements/evaluateAchievements'
import AchievementCollectionClient from './dashboard-achievements-client'
import styles from './dashboard-og.module.css'

export default async function DashboardAchievements({
  userId,
}: {
  userId: string
}) {
  const collection = await safeEvaluateAchievements(userId, {
    sourceType: 'dashboard_reconciliation',
  })

  if (!collection) {
    return (
      <section className={styles.achievementPanel}>
        <p className={styles.progressKicker}>Achievements</p>
        <h2 className={styles.progressLedgerTitle}>Seal ledger unavailable</h2>
        <p className={styles.achievementBody}>
          The collection could not be refreshed just now. Your bench record is
          safe; try again after the workshop dust settles.
        </p>
      </section>
    )
  }

  return <AchievementCollectionClient collection={collection} />
}
