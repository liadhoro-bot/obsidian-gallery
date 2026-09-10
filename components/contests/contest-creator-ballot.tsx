'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Contest, ContestNomination } from '../../lib/contests/types'
import { getNomineeCopy } from '../../lib/contests/nominee-copy'
import PendingSubmitButton from './pending-submit-button'
import styles from './contest-v3-silver.module.css'

type CreatorChoice = {
  id: string
  name: string
  representativeNominationId: string
  guides: ContestNomination[]
}

function creatorNameFor(nomination: ContestNomination) {
  return nomination.snapshot_owner_display_name || 'Gallery Creator'
}

function initials(name: string) {
  const letters = name.replace(/^@/, '').match(/[a-z0-9]/gi)
  return letters?.slice(0, 2).join('').toUpperCase() || 'OG'
}

function buildChoices(nominations: ContestNomination[], viewerUserId?: string | null) {
  const byOwner = new Map<string, CreatorChoice>()

  for (const nomination of nominations) {
    if (viewerUserId && nomination.owner_user_id === viewerUserId) continue
    const current = byOwner.get(nomination.owner_user_id)

    if (current) {
      current.guides.push(nomination)
      continue
    }

    byOwner.set(nomination.owner_user_id, {
      id: nomination.owner_user_id,
      name: creatorNameFor(nomination),
      representativeNominationId: nomination.id,
      guides: [nomination],
    })
  }

  return Array.from(byOwner.values()).sort((first, second) =>
    first.name.localeCompare(second.name)
  )
}

export default function ContestCreatorBallot({
  action,
  contest,
  initialCreatorId,
  nominations,
  viewerUserId,
}: {
  action: (formData: FormData) => void
  contest: Contest
  initialCreatorId?: string
  nominations: ContestNomination[]
  viewerUserId?: string | null
}) {
  const nomineeCopy = getNomineeCopy(contest)
  const choices = useMemo(
    () => buildChoices(nominations, contest.allow_self_vote ? null : viewerUserId),
    [contest.allow_self_vote, nominations, viewerUserId]
  )
  const initialFirst = initialCreatorId && choices.some((choice) => choice.id === initialCreatorId)
    ? initialCreatorId
    : ''
  const [firstPlace, setFirstPlace] = useState(initialFirst)
  const [secondPlace, setSecondPlace] = useState('')
  const selectedChoices = [firstPlace, secondPlace]
    .map((id) => choices.find((choice) => choice.id === id))
    .filter((choice): choice is CreatorChoice => Boolean(choice))
  const canSubmit = Boolean(firstPlace && secondPlace && firstPlace !== secondPlace)

  function choose(place: 1 | 2, creatorId: string) {
    if (place === 1) {
      setFirstPlace(creatorId)
      if (secondPlace === creatorId) setSecondPlace('')
      return
    }

    setSecondPlace(creatorId)
    if (firstPlace === creatorId) setFirstPlace('')
  }

  return (
    <form action={action} className={styles.creatorBallot}>
      <input type="hidden" name="contestId" value={contest.id} />
      <input type="hidden" name="slug" value={contest.slug} />
      {selectedChoices.map((choice) => (
        <input
          key={choice.id}
          type="hidden"
          name="nominationIds"
          value={choice.representativeNominationId}
        />
      ))}

      <article className={styles.paperPanel}>
        <p className={styles.eyebrow}>Choose Your Winners</p>
        <p className={styles.bodyText}>
          Pick a different {nomineeCopy.voteNoun} for each place. 1st place is worth 2 points;
          2nd place is worth 1 point.
        </p>
      </article>

      {choices.length < 2 ? (
        <article className={styles.emptyState}>
          <p className={styles.emptyTitle}>More {nomineeCopy.entryNounPlural} are needed before voting can begin.</p>
          <p className={styles.mutedText}>A valid ballot needs two different {nomineeCopy.voteNoun}s.</p>
          <Link href={`/contests/${contest.slug}`} className={styles.brassButton}>
            Back to Contest
          </Link>
        </article>
      ) : (
        <div className={styles.creatorVoteList}>
          {choices.map((choice) => (
            <CreatorVoteCard
              key={choice.id}
              choice={choice}
              firstPlace={firstPlace}
              secondPlace={secondPlace}
              onChoose={choose}
              entryNoun={nomineeCopy.entryNoun}
              entryNounPlural={nomineeCopy.entryNounPlural}
            />
          ))}
        </div>
      )}

      <div className={styles.ballotDock}>
        <div>
          <strong>{selectedChoices.length} of 2 selected</strong>
          <span>1st: {selectedChoices[0]?.name || `Choose ${nomineeCopy.voteNoun}`} · 2nd: {selectedChoices[1]?.name || `Choose ${nomineeCopy.voteNoun}`}</span>
        </div>
        <PendingSubmitButton
          disabled={!canSubmit}
          pendingLabel="Submitting..."
          className={styles.submitButton}
        >
          Submit Ballot
        </PendingSubmitButton>
      </div>
    </form>
  )
}

function CreatorVoteCard({
  choice,
  entryNoun,
  entryNounPlural,
  firstPlace,
  onChoose,
  secondPlace,
}: {
  choice: CreatorChoice
  entryNoun: string
  entryNounPlural: string
  firstPlace: string
  secondPlace: string
  onChoose: (place: 1 | 2, creatorId: string) => void
}) {
  const firstSelected = firstPlace === choice.id
  const secondSelected = secondPlace === choice.id
  const count = choice.guides.length

  return (
    <article className={styles.creatorVoteCard}>
      <div className={styles.creatorAvatar}>{initials(choice.name)}</div>
      <div className={styles.creatorCardBody}>
        <strong>{choice.name}</strong>
        <small>{count} {count === 1 ? entryNoun : entryNounPlural}</small>
        <div className={styles.guideThumbStrip}>
          {choice.guides.slice(0, 4).map((guide) => (
            <span key={guide.id} className={styles.guideThumb}>
              <Image src={guide.snapshot_image_url} alt="" fill sizes="42px" className="object-cover" />
            </span>
          ))}
        </div>
      </div>
      <div className={styles.placeButtons}>
        <button
          type="button"
          aria-pressed={firstSelected}
          onClick={() => onChoose(1, choice.id)}
        >
          1st
        </button>
        <button
          type="button"
          aria-pressed={secondSelected}
          onClick={() => onChoose(2, choice.id)}
        >
          2nd
        </button>
      </div>
    </article>
  )
}
