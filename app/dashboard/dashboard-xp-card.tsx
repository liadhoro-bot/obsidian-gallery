import {
  getDashboardCurrentUser,
  getDashboardXpState,
} from './dashboard-data'
import { OgProgressTrack } from '@/src/components/v3'
import styles from './dashboard-og.module.css'

export type DashboardXpLedgerCardProps = {
  currentLevel: number
  progressPercent: number
  xpIntoLevel: number
  xpNeededForLevel: number
  xpToNextLevel: number
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

export function DashboardXpLedgerCard({
  currentLevel,
  progressPercent,
  xpIntoLevel,
  xpNeededForLevel,
  xpToNextLevel,
}: DashboardXpLedgerCardProps) {
  return (
    <section className={styles.progressLedger} data-v3-dashboard-indicator="xp-card">
      <div className={styles.progressLedgerHeader}>
        <div>
          <p className={styles.progressKicker}>Path to Grandmastery</p>
          <h2 className={styles.progressLedgerTitle}>Level {currentLevel}</h2>
        </div>
        <div className={styles.levelMedallion} aria-label={`Current level ${currentLevel}`}>
          {currentLevel}
        </div>
      </div>

      <div className={styles.xpReadout}>
        <span className={styles.xpValue}>{xpIntoLevel} / {xpNeededForLevel}</span>
        <span>{xpToNextLevel} XP to Level {currentLevel + 1}</span>
      </div>

      <OgProgressTrack
        className={styles.profileProgressTrack}
        label="XP progress toward next level"
        value={progressPercent}
      />
    </section>
  )
}
