'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitArmyBallotAction } from '../../lib/contests/actions'
import type { Contest, ContestNomination } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

export default function ArmyBallotModal({ contest, nominations, viewerUserId, onClose }: {
  contest: Contest
  nominations: ContestNomination[]
  viewerUserId: string
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const choices = nominations.filter((entry) => entry.status === 'approved')
  const eligible = choices.filter((entry) => entry.owner_user_id !== viewerUserId)
  const valid = first !== second && [first, second].every((id) => eligible.some((entry) => entry.id === id))

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  function submit() {
    if (!valid || pending) return
    startTransition(async () => {
      try {
        const result = await submitArmyBallotAction(contest.id, [first, second])
        if (result.error) { setError(result.error); return }
        setSubmitted(true)
        router.refresh()
      } catch {
        setError('We could not confirm your vote. Refresh My Activity to check whether it was recorded before trying again.')
      }
    })
  }

  return (
    <dialog ref={dialog} className={`${styles.modalPanel} ${styles.ballotDialog}`} aria-labelledby="army-ballot-title"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }}>
      <div className={styles.modalHeader}>
        <h2 id="army-ballot-title">{submitted ? 'Your vote is recorded' : confirming ? 'Finalize your vote?' : 'Cast your vote'}</h2>
        <button type="button" className={styles.modalCloseButton} disabled={pending} onClick={onClose} aria-label="Close ballot">×</button>
      </div>
      <div className={styles.modalList}>
        {submitted ? <p>Your ballot is final. Thank you for helping choose who takes the prize!</p> : confirming ? (
          <>
            <p>Once submitted, you cannot change or undo your vote. Other participants cannot see your choices.</p>
            <p><strong>1st place · 2 points:</strong> {choices.find((entry) => entry.id === first)?.snapshot_title}</p>
            <p><strong>2nd place · 1 point:</strong> {choices.find((entry) => entry.id === second)?.snapshot_title}</p>
          </>
        ) : (
          <>
            <p>Choose who takes the prize. Select a different army for each place. You cannot vote for your own entry.</p>
            {eligible.length < 2 ? <p role="status">There are not enough eligible entries to cast your ballot yet.</p> : null}
            {([1, 2] as const).map((rank) => (
              <fieldset key={rank} className={styles.ballotChoices}>
                <legend>{rank === 1 ? '1st place · 2 points' : '2nd place · 1 point'}</legend>
                {choices.map((entry) => {
                  const own = entry.owner_user_id === viewerUserId
                  const otherSelected = entry.id === (rank === 1 ? second : first)
                  return (
                    <label key={entry.id} className={`${styles.modalPickerRow} ${styles.ballotChoice}`}>
                      <input type="radio" name={`army-rank-${rank}`} value={entry.id}
                        checked={entry.id === (rank === 1 ? first : second)} disabled={own || otherSelected}
                        onChange={() => rank === 1 ? setFirst(entry.id) : setSecond(entry.id)} />
                      <span>{entry.snapshot_title}{own ? <small> Your entry — unavailable</small> : otherSelected ? <small> Selected for the other place</small> : null}</span>
                    </label>
                  )
                })}
              </fieldset>
            ))}
          </>
        )}
        {error ? <p className={styles.errorPanel} role="alert">{error}</p> : null}
      </div>
      <div className={styles.ballotFooter}>
        {submitted ? <button type="button" className={styles.brassButton} onClick={onClose}>Done</button> : (
          <>
            <button type="button" className={styles.sortButton} disabled={pending} onClick={() => confirming ? setConfirming(false) : onClose()}>{confirming ? 'Back' : 'Cancel'}</button>
            <button type="button" className={styles.brassButton} disabled={!valid || pending}
              onClick={() => { setError(null); if (confirming) submit(); else setConfirming(true) }}>
              {pending ? 'Submitting…' : confirming ? 'Confirm final vote' : 'Review your vote'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
