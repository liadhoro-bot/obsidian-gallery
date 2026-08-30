import Link from 'next/link'
import DiceRollForm from './dice-roll-form'
import styles from '../../../components/contests/contest-v3-silver.module.css'

export const metadata = {
  title: 'Remote Campaign Roll | Obsidian Gallery',
  description: 'Roll a logged 1d6 or 2d6 result for an Obsidian Gallery campaign.',
}

export default function CampaignDiceRollPage() {
  return (
    <main className={styles.contestSilver}>
      <div className={`${styles.pageRail} ${styles.narrowRail}`}>
        <header className={styles.diceHeader}>
          <Link
            href="/community"
            className={styles.backLink}
          >
            Back to community
          </Link>
          <p className={styles.eyebrow}>Campaign tool</p>
          <h1 className={styles.pageTitle}>Remote Campaign Roll</h1>
          <p className={styles.pageSubtitle}>
            Enter your campaign player name and the reason for the roll. Each player can roll
            once per reason, with every result logged and sent to the campaign organizer.
          </p>
        </header>

        <DiceRollForm />
      </div>
    </main>
  )
}
