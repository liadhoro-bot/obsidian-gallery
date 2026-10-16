'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitGuideCreatorBallotAction } from '../../lib/contests/actions'
import type { GuideCreatorLeaderboardEntry } from '../../lib/contests/queries'
import { getOrdinal } from '../../lib/contests/nominee-copy'
import { getRankedPoints } from '../../lib/contests/ranking'
import type { Contest } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

// Two rows of thumbnails on a phone; the last slot becomes "+N" when there are more.
const maxThumbs = 12

function initials(name: string) {
  const letters = name.replace(/^@/, '').match(/[a-z0-9]/gi)
  return letters?.slice(0, 2).join('').toUpperCase() || 'OG'
}

function pointsLabel(points: number) {
  return `${points} ${points === 1 ? 'point' : 'points'}`
}

function CreatorAvatar({ creator, small }: { creator: GuideCreatorLeaderboardEntry; small?: boolean }) {
  return (
    <span className={`${styles.creatorAvatar} ${styles.ballotAvatar} ${small ? styles.ballotAvatarSmall : ''}`} aria-hidden="true">
      {creator.avatarUrl
        ? <Image unoptimized src={creator.avatarUrl} alt="" fill sizes={small ? '28px' : '56px'} className="object-cover" />
        : initials(creator.ownerName)}
    </span>
  )
}

export default function GuideCreatorBallotModal({ contest, creators, initialPicks = [], isChange = false, preview, onClose }: {
  contest: Contest
  creators: GuideCreatorLeaderboardEntry[]
  // Places filled when the dialog opens: an existing ballot, or a creator page's "Vote for" pick.
  initialPicks?: string[]
  isChange?: boolean
  // Dev-only: lets the ballot be exercised before voting opens without recording anything.
  preview?: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const places = contest.maximum_selections_per_ballot
  const eligible = useMemo(
    () => creators.filter((creator) => contest.allow_self_vote || !creator.isViewer),
    [contest.allow_self_vote, creators]
  )
  const [picks, setPicks] = useState<string[]>(() =>
    Array.from({ length: places }, (_, index) => {
      const id = initialPicks[index]
      return id && eligible.some((creator) => creator.ownerId === id) ? id : ''
    })
  )
  const [openPlace, setOpenPlace] = useState<number | null>(() => {
    const firstEmpty = picks.findIndex((id) => !id)
    return firstEmpty === -1 ? null : firstEmpty
  })
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const creatorById = useMemo(() => new Map(eligible.map((creator) => [creator.ownerId, creator])), [eligible])
  const complete = picks.every(Boolean) && new Set(picks).size === places
  const hasOwnEntry = !contest.allow_self_vote && creators.some((creator) => creator.isViewer)

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

  useEffect(() => {
    if (openPlace === null) return
    dialog.current?.querySelector(`[data-place="${openPlace}"] > button`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [openPlace])

  function choose(place: number, creatorId: string) {
    const next = picks.map((id, index) => (index === place ? creatorId : id))
    setPicks(next)
    // Fold this place and unfold the next one still waiting for a pick.
    const following = [...next.slice(place + 1), ...next.slice(0, place)].findIndex((id) => !id)
    setOpenPlace(following === -1 ? null : (place + 1 + following) % places)
  }

  function submit() {
    if (!complete || pending) return
    startTransition(async () => {
      if (preview) {
        await new Promise((resolve) => setTimeout(resolve, 600))
        setSubmitted(true)
        return
      }
      try {
        const result = await submitGuideCreatorBallotAction(contest.id, picks)
        if (result.error) { setError(result.error); return }
        setSubmitted(true)
        router.refresh()
      } catch {
        // The request itself failed (signed out, page older than the app, or a
        // network drop), so nothing came back to say whether it was saved.
        setError('Your vote didn’t go through. Reload the page and try again. If it was saved, the page will show that you’ve voted.')
        router.refresh()
      }
    })
  }

  const title = submitted ? (preview ? 'Preview complete' : 'Your vote is recorded') : confirming ? 'Finalize your vote?' : isChange ? 'Change your vote' : 'Cast your vote'

  return (
    <dialog ref={dialog} className={`${styles.modalPanel} ${styles.ballotDialog}`} aria-labelledby="guide-ballot-title"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }}>
      <div className={styles.modalHeader}>
        <h2 id="guide-ballot-title">{title}</h2>
        <button type="button" className={styles.modalCloseButton} disabled={pending} onClick={onClose} aria-label="Close ballot">×</button>
      </div>
      <div className={styles.modalList}>
        {preview ? <p className={styles.ballotPreviewNote}>Preview — votes are not recorded.</p> : null}
        {submitted ? (
          <p>
            {preview ? 'Preview complete. No vote was recorded.' : contest.allow_ballot_changes
              ? 'Thank you for voting! You can change your ballot from My Activity until voting closes.'
              : 'Your ballot is final. Thank you for helping choose the top hobby guide creators!'}
          </p>
        ) : confirming ? (
          <>
            <p>
              {contest.allow_ballot_changes
                ? 'You can change your vote until voting closes. Other participants cannot see your choices.'
                : 'Once submitted, you cannot change or undo your vote. Other participants cannot see your choices.'}
            </p>
            <ol className={styles.ballotSummary}>
              {picks.map((id, index) => {
                const creator = creatorById.get(id)!
                return (
                  <li key={id}>
                    <span className={styles.ballotRankBadge}>{getOrdinal(index + 1)}</span>
                    <CreatorAvatar creator={creator} small />
                    <strong>{creator.ownerName}</strong>
                    <span className={styles.ballotPoints}>{pointsLabel(getRankedPoints(places, index + 1))}</span>
                  </li>
                )
              })}
            </ol>
          </>
        ) : (
          <>
            <p>
              Rank your top {places} hobby guide creators. Your 1st place gets {pointsLabel(getRankedPoints(places, 1))},{' '}
              {Array.from({ length: places - 1 }, (_, index) =>
                `${getOrdinal(index + 2)} gets ${pointsLabel(getRankedPoints(places, index + 2))}`
              ).join(', and ')}.
              {hasOwnEntry ? ' You cannot vote for yourself.' : ''}
              {contest.allow_ballot_changes ? '' : ' Your vote is final once you submit it.'}
            </p>
            {eligible.length < places ? (
              <p role="status">There are not enough eligible creators to cast your ballot yet.</p>
            ) : picks.map((pickedId, place) => {
              const picked = creatorById.get(pickedId)
              const isOpen = openPlace === place
              const panelId = `guide-ballot-place-${place + 1}`
              const choices = eligible.filter((creator) =>
                !picks.some((id, index) => index !== place && id === creator.ownerId)
              )
              return (
                <section key={place} className={styles.ballotPlace} data-place={place} data-open={isOpen || undefined} data-picked={Boolean(picked) || undefined}>
                  <button type="button" className={styles.ballotPlaceToggle} aria-expanded={isOpen} aria-controls={panelId}
                    onClick={() => setOpenPlace(isOpen ? null : place)}>
                    <span className={styles.ballotRankBadge}>{getOrdinal(place + 1)}</span>
                    <span className={styles.ballotPlaceText}>
                      <strong>{getOrdinal(place + 1)} place · {pointsLabel(getRankedPoints(places, place + 1))}</strong>
                      {picked ? (
                        <span className={styles.ballotPlacePick}><CreatorAvatar creator={picked} small />{picked.ownerName}</span>
                      ) : <small>Choose a creator</small>}
                    </span>
                    <span className={styles.ballotChevron} aria-hidden="true">▾</span>
                  </button>
                  {isOpen ? (
                    <fieldset id={panelId} className={styles.ballotPlaceChoices}>
                      <legend className="sr-only">{getOrdinal(place + 1)} place</legend>
                      {choices.map((creator) => {
                        const shown = creator.guideCount > maxThumbs ? maxThumbs - 1 : maxThumbs
                        const thumbs = creator.guideImageUrls.slice(0, shown)
                        const extra = creator.guideCount - thumbs.length
                        return (
                          <label key={creator.ownerId} className={styles.ballotCreatorRow}>
                            <input type="radio" className={styles.ballotRadio} name={`guide-rank-${place + 1}`} value={creator.ownerId}
                              aria-label={`${creator.ownerName}, ${creator.guideCount} ${creator.guideCount === 1 ? 'guide' : 'guides'}`}
                              checked={pickedId === creator.ownerId} onChange={() => choose(place, creator.ownerId)} />
                            <span className={styles.ballotAvatarWrap}>
                              <CreatorAvatar creator={creator} />
                              <span className={styles.ballotCheck} aria-hidden="true" />
                            </span>
                            <span className={styles.ballotCreatorBody}>
                              <strong>{creator.ownerName}</strong>
                              <small>{creator.guideCount} {creator.guideCount === 1 ? 'guide' : 'guides'} published</small>
                            </span>
                            <span className={styles.ballotThumbs}>
                              {thumbs.map((url) => (
                                <span key={url} className={styles.ballotThumb}>
                                  <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                                </span>
                              ))}
                              {extra > 0 ? <span className={`${styles.ballotThumb} ${styles.ballotThumbMore}`}>+{extra}</span> : null}
                            </span>
                          </label>
                        )
                      })}
                    </fieldset>
                  ) : null}
                </section>
              )
            })}
          </>
        )}
        {error ? <p className={styles.errorPanel} role="alert">{error}</p> : null}
      </div>
      <div className={styles.ballotFooter}>
        {submitted ? <button type="button" className={styles.brassButton} onClick={onClose}>Done</button> : (
          <>
            <button type="button" className={styles.sortButton} disabled={pending} onClick={() => confirming ? setConfirming(false) : onClose()}>{confirming ? 'Back' : 'Cancel'}</button>
            <button type="button" className={styles.brassButton} disabled={!complete || pending}
              onClick={() => { setError(null); if (confirming) submit(); else setConfirming(true) }}>
              {pending ? 'Submitting…' : confirming ? 'Confirm your vote' : 'Review your vote'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
