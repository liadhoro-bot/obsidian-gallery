import { getPhaseLabel } from '../../lib/contests/phases'
import type { ContestPhase } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

const phaseClassName: Record<ContestPhase, string> = {
  draft: '',
  upcoming: '',
  submissions_open: styles.phaseSubmissions,
  moderation: '',
  voting_open: styles.phaseVoting,
  voting_closed: '',
  results_published: styles.phaseResults,
  cancelled: '',
  archived: '',
}

export default function ContestPhaseBadge({ phase }: { phase: ContestPhase }) {
  return (
    <span
      className={`${styles.phaseBadge} ${phaseClassName[phase]}`}
    >
      {getPhaseLabel(phase)}
    </span>
  )
}
