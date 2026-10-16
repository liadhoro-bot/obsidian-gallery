'use client'

import { useState } from 'react'
import type { GuideCreatorLeaderboardEntry } from '../../lib/contests/queries'
import type { Contest } from '../../lib/contests/types'
import GuideCreatorBallotModal from './guide-creator-ballot-modal'
import { CreatorGateDialog, type CreatorPageGateProps } from './creator-page-gate'
import styles from './contest-v3-silver.module.css'

export type CreatorVoteState = 'open' | 'not_open' | 'voted'

export default function CreatorVoteCta({ contest, creators, creatorId, creatorName, state, opensLabel, preview, gate }: {
  contest: Contest
  creators: GuideCreatorLeaderboardEntry[]
  creatorId: string
  creatorName: string
  state: CreatorVoteState
  opensLabel: string
  preview?: boolean
  // Set for logged-out or non-member visitors: the button asks them to log in
  // or start a trial instead of opening the ballot.
  gate?: CreatorPageGateProps
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={styles.creatorVoteCta}>
      <button type="button" className={`${styles.brassButton} ${styles.ctaButtonFull}`}
        disabled={state !== 'open'} onClick={() => setIsOpen(true)}>
        {state === 'voted' ? 'You have already voted' : `Vote for ${creatorName} now`}
      </button>
      {state === 'not_open' ? <small>Voting opens {opensLabel}</small> : null}
      {isOpen && gate ? (
        <CreatorGateDialog {...gate} wantsToVote onClose={() => setIsOpen(false)} />
      ) : isOpen ? (
        <GuideCreatorBallotModal
          contest={contest}
          creators={creators}
          initialPicks={[creatorId]}
          preview={preview}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  )
}
