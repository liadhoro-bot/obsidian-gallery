import {
  getDashboardCurrentUser,
  getDashboardXpState,
} from './dashboard-data'
import { OgProgressTrack } from '@/src/components/v3'
import styles from './dashboard-og.module.css'

export function DashboardXpLedgerCard({
  currentLevel,
  progressPercent,
  xpIntoLevel,
  xpNeededForLevel,
  xpToNextLevel,
}: {
  currentLevel: number
  progressPercent: number
  xpIntoLevel: number
  xpNeededForLevel: number
  xpToNextLevel: number
}) {
  return (
    <section
      className={styles.progressLedger}
      data-v3-dashboard-indicator="xp-card"
    >
      <div className={styles.progressLedgerHeader}>
        <div>
          <p className={styles.progressKicker}>Path to Grandmastery</p>
          <h2 className={styles.progressLedgerTitle}>
            {xpIntoLevel} / {xpNeededForLevel}
          </h2>
        </div>
        <span className={styles.levelMedallion}>Lv. {currentLevel}</span>
      </div>

      <div className={styles.xpReadout}>
        <span>{xpToNextLevel} XP to Level {currentLevel + 1}</span>
        <span className={styles.xpValue}>{progressPercent}%</span>
      </div>

      <OgProgressTrack
        className={styles.profileProgressTrack}
        label="Path to Grandmastery progress"
        value={progressPercent}
      />
    </section>
  )
}

export default async function DashboardXpCard({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id

  if (!resolvedUserId) return null

  const {
    currentLevel,
    xpIntoLevel,
    xpNeededForLevel,
    xpToNextLevel,
    progressPercent,
  } = await getDashboardXpState(resolvedUserId)

  return (
    <DashboardXpLedgerCard
      currentLevel={currentLevel}
      progressPercent={progressPercent}
      xpIntoLevel={xpIntoLevel}
      xpNeededForLevel={xpNeededForLevel}
      xpToNextLevel={xpToNextLevel}
    />
  )
}
