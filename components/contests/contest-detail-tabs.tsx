'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getContestPhase } from '../../lib/contests/phases'
import {
  getNomineeCopy,
  getNomineeType,
  getPhaseHeadline,
  type NomineeCopy,
} from '../../lib/contests/nominee-copy'
import { submitNominationAction } from '../../lib/contests/actions'
import type { ContestPickerSource } from '../../lib/contests/queries'
import type {
  Contest,
  ContestBallot,
  ContestNomination,
  ContestNomineeType,
} from '../../lib/contests/types'
import NominateModal from './nominate-modal'
import styles from './contest-v3-silver.module.css'

type ContestDetailTab = 'details' | 'entries' | 'my-activity'
type EntrySort = 'newest' | 'title'

const tabs: Array<{ key: ContestDetailTab; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'entries', label: 'Entries' },
  { key: 'my-activity', label: 'My Activity' },
]

function formatDate(value: string | null, withYear = false) {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(value))
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} - ${formatDate(end)}`
}

function daysUntil(value: string | null) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function entryOwnerName(nomination: ContestNomination, hideIdentity?: boolean) {
  if (hideIdentity) return 'Gallery Member'
  return nomination.snapshot_owner_display_name || 'Gallery Member'
}

function initialsFor(name: string) {
  const letters = name.replace(/^@/, '').match(/[a-z0-9]/gi)
  return letters?.slice(0, 2).join('').toUpperCase() || 'OG'
}

function ballotEntryNames(
  ballot: ContestBallot | null,
  nominations: ContestNomination[],
  hideIdentity?: boolean
) {
  if (!ballot?.contest_ballot_items?.length) return []
  const nominationById = new Map(nominations.map((nomination) => [nomination.id, nomination]))

  return [...ballot.contest_ballot_items]
    .sort((first, second) => (first.selection_rank ?? 99) - (second.selection_rank ?? 99))
    .map((item) => {
      const nomination = nominationById.get(item.nomination_id)
      return nomination ? entryOwnerName(nomination, hideIdentity) : null
    })
    .filter((name): name is string => Boolean(name))
}

export default function ContestDetailTabs({
  ballot,
  contest,
  hideIdentity,
  isEligibleParticipant = true,
  nominations,
  pickerSources = [],
  userNominations,
}: {
  ballot: ContestBallot | null
  contest: Contest
  hideIdentity?: boolean
  isEligibleParticipant?: boolean
  nominations: ContestNomination[]
  pickerSources?: ContestPickerSource[]
  results: unknown[]
  userNominations: ContestNomination[]
}) {
  const [activeTab, setActiveTab] = useState<ContestDetailTab>('details')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<EntrySort>('newest')
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false)
  const phase = getContestPhase(contest)
  const votingIsOpen = phase === 'voting_open'
  const votingHasClosed = ['voting_closed', 'results_published'].includes(phase)
  const nomineeType = getNomineeType(contest)
  const nomineeCopy = getNomineeCopy(contest)
  const activeUserNominations = userNominations.filter((nomination) =>
    ['approved', 'pending'].includes(nomination.status)
  )
  const sortedNominations = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? nominations.filter(
          (nomination) =>
            nomination.snapshot_title.toLowerCase().includes(needle) ||
            entryOwnerName(nomination, hideIdentity).toLowerCase().includes(needle)
        )
      : nominations

    return [...filtered].sort((first, second) => {
      if (sort === 'title') return first.snapshot_title.localeCompare(second.snapshot_title)
      return new Date(second.submitted_at).getTime() - new Date(first.submitted_at).getTime()
    })
  }, [hideIdentity, nominations, search, sort])
  const submittedEntryNames = ballotEntryNames(ballot, nominations, hideIdentity)
  const votingOpensIn = daysUntil(contest.voting_open_at)
  const votingClosesIn = daysUntil(contest.voting_close_at)
  const hasReachedNominationLimit =
    activeUserNominations.length >= contest.max_nominations_per_user
  const canOpenNominateModal =
    isEligibleParticipant && phase === 'submissions_open' && !hasReachedNominationLimit

  function cycleSort() {
    setSort((current) => (current === 'newest' ? 'title' : 'newest'))
  }

  return (
    <section className={styles.tabbedWorkbench}>
      <div className={styles.segmentedTabs} role="tablist" aria-label="Contest sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={styles.segmentedTab}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div hidden={activeTab !== 'details'} aria-hidden={activeTab !== 'details'}>
        <div className={styles.contestStack}>
          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>Prizes</p>
            <div className={contest.prize_second_place ? styles.prizeGrid : styles.prizeGridSingle}>
              <PrizeBlock
                medalSrc="/contests/medals/contest-prize-1st-gold.png"
                title="1st Place"
                amount={contest.prize_first_place || 'To be announced'}
              />
              {contest.prize_second_place ? (
                <PrizeBlock
                  medalSrc="/contests/medals/contest-prize-2nd-silver.png"
                  title="2nd Place"
                  amount={contest.prize_second_place}
                />
              ) : null}
            </div>
          </article>

          {contest.sponsor_name ? (
            <article className={styles.paperPanel}>
              <p className={styles.eyebrow}>Sponsor</p>
              <div className={styles.sponsorRow}>
                {contest.sponsor_logo_url ? (
                  <span className={styles.sponsorLogo}>
                    <Image
                      src={contest.sponsor_logo_url}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </span>
                ) : null}
                <p className={styles.sponsorText}>
                  Sponsored by <strong>{contest.sponsor_name}</strong>
                </p>
              </div>
            </article>
          ) : null}

          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>How It Works</p>
            <div className={styles.stepList}>
              {(contest.how_it_works ?? []).map((step, index) => (
                <HowItWorksStep
                  key={`${step.title}-${index}`}
                  number={String(index + 1)}
                  title={step.title}
                  copy={step.body}
                />
              ))}
            </div>
            {canOpenNominateModal ? (
              <button
                type="button"
                onClick={() => setIsNominateModalOpen(true)}
                className={`${styles.brassButton} ${styles.ctaButtonFull}`}
              >
                {nomineeCopy.actionVerb}
              </button>
            ) : !isEligibleParticipant ? (
              <p className={styles.mutedText}>
                Nominations are limited to invited participants.
              </p>
            ) : null}
            <div className={styles.dateStrip}>
              <DateChip label={nomineeCopy.periodLabel} value={formatDateRange(contest.submissions_open_at, contest.submissions_close_at)} />
              <DateChip label="Voting" value={formatDateRange(contest.voting_open_at, contest.voting_close_at)} />
              <DateChip label="Winners" value={formatDate(contest.results_published_at || contest.results_target_at || contest.voting_close_at)} />
            </div>
            <Link href={`/contests/${contest.slug}/details`} className={styles.detailLinkRow}>
              <span>Read full contest details</span>
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </div>

      <div hidden={activeTab !== 'entries'} aria-hidden={activeTab !== 'entries'}>
        <div className={styles.nominationWorkbench}>
          <div className={styles.nominationToolbar}>
            <label className={styles.searchBox}>
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">Search entries</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search entries..."
              />
            </label>
            <button
              type="button"
              className={styles.sortButton}
              onClick={cycleSort}
              aria-label={`Sort entries by ${sort}`}
            >
              ☰
            </button>
          </div>

          {sortedNominations.length === 0 ? (
            <article className={styles.emptyState}>
              <p className={styles.emptyTitle}>The gallery is waiting for its first entries.</p>
              <p className={styles.mutedText}>Enter the contest and become part of the challenge.</p>
              {canOpenNominateModal ? (
                <button
                  type="button"
                  onClick={() => setIsNominateModalOpen(true)}
                  className={styles.brassButton}
                >
                  {nomineeCopy.actionVerb}
                </button>
              ) : null}
            </article>
          ) : (
            <div className={styles.entryGrid}>
              {sortedNominations.map((nomination) => (
                <EntryTile
                  key={nomination.id}
                  contestSlug={contest.slug}
                  hideIdentity={hideIdentity}
                  nomination={nomination}
                  nomineeType={nomineeType}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div hidden={activeTab !== 'my-activity'} aria-hidden={activeTab !== 'my-activity'}>
        <div className={styles.standingStack}>
          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>Your Status</p>
            {activeUserNominations.length > 0 ? (
              <>
                <div className={styles.statusLead}>
                  <span className={styles.successDot} aria-hidden="true">✓</span>
                  <div>
                    <h2>You&apos;re in!</h2>
                    <p>
                      {activeUserNominations.length}{' '}
                      {activeUserNominations.length === 1 ? nomineeCopy.entryNoun : nomineeCopy.entryNounPlural}{' '}
                      currently representing you in the contest.
                    </p>
                  </div>
                </div>
                <NomineeThumbStrip nominations={activeUserNominations} prominent />
                {canOpenNominateModal ? (
                  <button
                    type="button"
                    onClick={() => setIsNominateModalOpen(true)}
                    className={styles.brassButton}
                  >
                    {contest.max_nominations_per_user > 1
                      ? `Add Another ${nomineeCopy.entryNounCapitalized}`
                      : nomineeCopy.actionVerb}
                  </button>
                ) : null}
              </>
            ) : canOpenNominateModal ? (
              <div className={styles.emptyParticipation}>
                <h2>Your place in the Gallery is still empty.</h2>
                <p>Enter the contest to strengthen your showcase.</p>
                <button
                  type="button"
                  onClick={() => setIsNominateModalOpen(true)}
                  className={styles.brassButton}
                >
                  {nomineeCopy.actionVerb}
                </button>
                <small>
                  No entry fee ·{' '}
                  {contest.max_nominations_per_user > 1
                    ? `Up to ${contest.max_nominations_per_user} ${nomineeCopy.entryNounPlural}`
                    : `1 ${nomineeCopy.entryNoun}`}
                </small>
              </div>
            ) : (
              <div className={styles.emptyParticipation}>
                <h2>This contest is invite-only.</h2>
                <p>
                  You haven&apos;t been added to the participant list for this contest.
                  Reach out to the organizer if you think this is a mistake.
                </p>
              </div>
            )}
          </article>

          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>Your Vote</p>
            {!isEligibleParticipant ? (
              <div className={styles.voteState}>
                <span className={styles.clockIcon} aria-hidden="true">○</span>
                <div>
                  <h2>Voting is limited to invited participants.</h2>
                  <p>You haven&apos;t been added to the participant list for this contest.</p>
                </div>
              </div>
            ) : ballot?.status !== 'submitted' && votingHasClosed ? (
              <div className={styles.voteState}>
                <span className={styles.clockIcon} aria-hidden="true">○</span>
                <div>
                  <h2>Voting has closed.</h2>
                  <p>You didn&apos;t cast a ballot for this contest.</p>
                </div>
              </div>
            ) : !votingIsOpen && ballot?.status !== 'submitted' ? (
              <div className={styles.voteState}>
                <span className={styles.clockIcon} aria-hidden="true">◷</span>
                <div>
                  <h2>
                    Voting opens {votingOpensIn === 1 ? 'in 1 day' : `in ${votingOpensIn ?? 0} days`}.
                  </h2>
                  <p>You&apos;ll be able to choose one {nomineeCopy.voteNoun} for 1st place (2 points) and one for 2nd place (1 point).</p>
                </div>
              </div>
            ) : ballot?.status === 'submitted' ? (
              <div className={styles.voteState}>
                <span className={styles.successDot} aria-hidden="true">✓</span>
                <div>
                  <h2>Ballot cast</h2>
                  <p><strong>1st</strong> — {submittedEntryNames[0] || 'Selection recorded'}</p>
                  <p><strong>2nd</strong> — {submittedEntryNames[1] || 'Selection recorded'}</p>
                  {contest.allow_ballot_changes && votingIsOpen ? (
                    <Link href={`/contests/${contest.slug}/vote`} className={styles.inlineTextLink}>
                      Edit ballot →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={styles.voteState}>
                <span className={styles.clockIcon} aria-hidden="true">○</span>
                <div>
                  <h2>Ballot not cast</h2>
                  <p>Voting closes {votingClosesIn === 1 ? 'in 1 day' : `in ${votingClosesIn ?? 0} days`}.</p>
                </div>
                <Link href={`/contests/${contest.slug}/vote`} className={styles.brassButton}>
                  Choose Your Winners
                </Link>
              </div>
            )}
          </article>

          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>Contest Timeline</p>
            <Timeline contest={contest} nomineeCopy={nomineeCopy} />
          </article>
        </div>
      </div>

      {isNominateModalOpen ? (
        <NominateModal
          action={submitNominationAction}
          contest={contest}
          entryNounCapitalized={nomineeCopy.entryNounCapitalized}
          onClose={() => setIsNominateModalOpen(false)}
          sources={pickerSources}
        />
      ) : null}
    </section>
  )
}

function PrizeBlock({
  amount,
  medalSrc,
  title,
}: {
  amount: string
  medalSrc: string
  title: string
}) {
  return (
    <div className={styles.prizeBlock}>
      <span className={styles.medal}>
        <Image
          src={medalSrc}
          alt=""
          fill
          sizes="72px"
          className="object-contain"
        />
      </span>
      <span>{title}</span>
      <strong>{amount}</strong>
    </div>
  )
}

function HowItWorksStep({
  copy,
  number,
  title,
}: {
  copy: string
  number: string
  title: string
}) {
  return (
    <div className={styles.howStepNoIcon}>
      <span className={styles.stepNumber}>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </div>
  )
}

function DateChip({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.dateChip}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EntryTile({
  contestSlug,
  hideIdentity,
  nomination,
  nomineeType,
}: {
  contestSlug: string
  hideIdentity?: boolean
  nomination: ContestNomination
  nomineeType: ContestNomineeType | undefined
}) {
  const href =
    nomineeType === 'guide'
      ? `/contests/${contestSlug}/vote?creator=${encodeURIComponent(nomination.owner_user_id)}`
      : `/contests/${contestSlug}/entries/${nomination.id}`
  const ownerName = entryOwnerName(nomination, hideIdentity)

  return (
    <Link href={href} className={`${styles.nomineeTile} block`}>
      <div className={styles.nomineeTileImage}>
        <Image
          src={nomination.snapshot_image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 220px"
          className="object-cover"
        />
      </div>
      <div className={styles.nomineeBody}>
        <h3 className={styles.tileTitle}>{nomination.snapshot_title}</h3>
        {!hideIdentity ? (
          <div className={styles.entryOwnerRow}>
            <span className={styles.entryOwnerAvatar}>{initialsFor(ownerName)}</span>
            <span className={styles.tileOwner}>{ownerName}</span>
          </div>
        ) : null}
      </div>
    </Link>
  )
}

function NomineeThumbStrip({
  nominations,
  prominent,
}: {
  nominations: ContestNomination[]
  prominent?: boolean
}) {
  const visible = nominations.slice(0, 4)
  const overflow = nominations.length - visible.length

  return (
    <div className={prominent ? styles.guideThumbStripLarge : styles.guideThumbStrip}>
      {visible.map((nomination) => (
        <span key={nomination.id} className={styles.guideThumb}>
          <Image
            src={nomination.snapshot_image_url}
            alt=""
            fill
            sizes={prominent ? '74px' : '42px'}
            className="object-cover"
          />
        </span>
      ))}
      {overflow > 0 ? <span className={styles.moreGuides}>+{overflow}</span> : null}
    </div>
  )
}

function Timeline({ contest, nomineeCopy }: { contest: Contest; nomineeCopy: NomineeCopy }) {
  const phase = getContestPhase(contest)
  const items = [
    {
      key: 'create',
      title: nomineeCopy.periodLabel,
      date: formatDateRange(contest.submissions_open_at, contest.submissions_close_at),
      state:
        phase === 'submissions_open'
          ? 'current'
          : ['moderation', 'voting_open', 'voting_closed', 'results_published'].includes(phase)
            ? 'complete'
            : 'upcoming',
    },
    {
      key: 'vote',
      title: 'Community Voting',
      date: formatDateRange(contest.voting_open_at, contest.voting_close_at),
      state:
        phase === 'voting_open'
          ? 'current'
          : ['voting_closed', 'results_published'].includes(phase)
            ? 'complete'
            : 'upcoming',
    },
    {
      key: 'winners',
      title: 'Winners Announced',
      date: formatDate(contest.results_published_at || contest.results_target_at || contest.voting_close_at),
      state: phase === 'results_published' ? 'current' : 'upcoming',
    },
  ]

  return (
    <div className={styles.timeline}>
      {items.map((item) => (
        <div key={item.key} className={`${styles.timelineItem} ${styles[`timeline-${item.state}`]}`}>
          <span aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            <small>{item.date}</small>
          </div>
          {item.state === 'current' ? <em>{getPhaseHeadline(contest)}</em> : null}
        </div>
      ))}
    </div>
  )
}
