'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { useMemo, useState } from 'react'
import type { Contest, ContestNomination } from '../../lib/contests/types'
import { getBallotSummary, getNomineeCopy, getOrdinal } from '../../lib/contests/nominee-copy'
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
  const maxSelections = contest.maximum_selections_per_ballot
  const choices = useMemo(
    () => buildChoices(nominations, contest.allow_self_vote ? null : viewerUserId),
    [contest.allow_self_vote, nominations, viewerUserId]
  )
  const initialRanks = useMemo(() => {
    const ranks = new Array<string>(maxSelections).fill('')
    if (initialCreatorId && choices.some((choice) => choice.id === initialCreatorId)) {
      ranks[0] = initialCreatorId
    }
    return ranks
  }, [choices, initialCreatorId, maxSelections])
  const [ranks, setRanks] = useState<string[]>(initialRanks)
  const selectedChoices = ranks
    .map((id) => choices.find((choice) => choice.id === id))
    .filter((choice): choice is CreatorChoice => Boolean(choice))
  const canSubmit =
    ranks.every((id) => Boolean(id)) && new Set(ranks).size === maxSelections

  function choose(place: number, creatorId: string) {
    setRanks((current) => {
      const next = current.map((id) => (id === creatorId ? '' : id))
      next[place - 1] = creatorId
      return next
    })
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
          Pick a different {nomineeCopy.voteNoun} for each place: {getBallotSummary(contest, nomineeCopy.voteNoun)}.
        </p>
      </article>

      {choices.length < maxSelections ? (
        <article className={styles.emptyState}>
          <p className={styles.emptyTitle}>More {nomineeCopy.entryNounPlural} are needed before voting can begin.</p>
          <p className={styles.mutedText}>
            A valid ballot needs {maxSelections} different {nomineeCopy.voteNoun}s.
          </p>
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
              ranks={ranks}
              onChoose={choose}
              entryNoun={nomineeCopy.entryNoun}
              entryNounPlural={nomineeCopy.entryNounPlural}
            />
          ))}
        </div>
      )}

      <div className={styles.ballotDock}>
        <div>
          <strong>{selectedChoices.length} of {maxSelections} selected</strong>
          <span>
            {ranks
              .map((id, index) => {
                const choice = choices.find((candidate) => candidate.id === id)
                return `${getOrdinal(index + 1)}: ${choice?.name || `Choose ${nomineeCopy.voteNoun}`}`
              })
              .join(' · ')}
          </span>
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
  onChoose,
  ranks,
}: {
  choice: CreatorChoice
  entryNoun: string
  entryNounPlural: string
  onChoose: (place: number, creatorId: string) => void
  ranks: string[]
}) {
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
        {ranks.map((_, index) => {
          const place = index + 1
          return (
            <button
              key={place}
              type="button"
              aria-pressed={ranks[index] === choice.id}
              onClick={() => onChoose(place, choice.id)}
            >
              {getOrdinal(place)}
            </button>
          )
        })}
      </div>
    </article>
  )
}
