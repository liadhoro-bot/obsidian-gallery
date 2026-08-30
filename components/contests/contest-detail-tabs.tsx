'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getContestPhase } from '../../lib/contests/phases'
import type {
  Contest,
  ContestBallot,
  ContestNomination,
  ContestResult,
} from '../../lib/contests/types'
import NomineeCard from './nominee-card'
import styles from './contest-v3-silver.module.css'

type ContestDetailTab = 'details' | 'nominations' | 'standing'
type NominationSort = 'rank' | 'newest' | 'name'

const tabs: Array<{ key: ContestDetailTab; label: string }> = [
  { key: 'details', label: 'Details' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'standing', label: 'My Standing' },
]

function formatDate(value: string | null) {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatNomineeType(type: string) {
  return type === 'guide' ? 'Guides' : `${type}s`
}

function getStatusLabel(status: ContestNomination['status']) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function buildRankByNominationId(results: ContestResult[]) {
  return new Map(results.map((result) => [result.nomination_id, result]))
}

export default function ContestDetailTabs({
  ballot,
  contest,
  hideIdentity,
  nominations,
  results,
  userNominations,
}: {
  ballot: ContestBallot | null
  contest: Contest
  hideIdentity?: boolean
  nominations: ContestNomination[]
  results: ContestResult[]
  userNominations: ContestNomination[]
}) {
  const [activeTab, setActiveTab] = useState<ContestDetailTab>('details')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<NominationSort>('rank')
  const phase = getContestPhase(contest)
  const allowedTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type) ?? []
  const submissionsAreOpen = phase === 'submissions_open'
  const rankByNominationId = useMemo(
    () => buildRankByNominationId(results),
    [results]
  )
  const acceptedNominations = userNominations.filter(
    (nomination) => nomination.status === 'approved'
  )
  const bestRank = acceptedNominations
    .map((nomination) => rankByNominationId.get(nomination.id)?.final_rank)
    .filter((rank): rank is number => typeof rank === 'number')
    .sort((a, b) => a - b)[0]
  const sortedNominations = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? nominations.filter((nomination) => {
          return (
            nomination.snapshot_title.toLowerCase().includes(needle) ||
            (nomination.snapshot_description ?? '').toLowerCase().includes(needle) ||
            (!hideIdentity &&
              (nomination.snapshot_owner_display_name ?? '')
                .toLowerCase()
                .includes(needle))
          )
        })
      : nominations

    return [...filtered].sort((first, second) => {
      if (sort === 'name') {
        return first.snapshot_title.localeCompare(second.snapshot_title)
      }

      if (sort === 'newest') {
        return (
          new Date(second.submitted_at).getTime() -
          new Date(first.submitted_at).getTime()
        )
      }

      const firstRank = rankByNominationId.get(first.id)?.final_rank ?? 9999
      const secondRank = rankByNominationId.get(second.id)?.final_rank ?? 9999
      if (firstRank !== secondRank) return firstRank - secondRank

      return (
        new Date(first.submitted_at).getTime() -
        new Date(second.submitted_at).getTime()
      )
    })
  }, [hideIdentity, nominations, rankByNominationId, search, sort])

  function cycleSort() {
    setSort((current) =>
      current === 'rank' ? 'newest' : current === 'newest' ? 'name' : 'rank'
    )
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
        <div className={styles.contentGrid}>
          <div className={styles.mainStack}>
            <article className={styles.paperPanel}>
              <p className={styles.eyebrow}>Description</p>
              <p className={styles.bodyText}>
                {contest.description ||
                  contest.short_description ||
                  'Contest details will be posted soon.'}
              </p>
            </article>

            <article className={styles.paperPanel}>
              <p className={styles.eyebrow}>Rules</p>
              <p className={styles.bodyText}>
                {contest.rules_markdown || 'Contest rules will be posted soon.'}
              </p>
            </article>
          </div>

          <aside className={styles.sideStack}>
            <article className={styles.paperPanel}>
              <p className={styles.eyebrow}>Contest Info</p>
              <dl className={styles.infoList}>
                <div>
                  <dt>Status</dt>
                  <dd>{phase.replaceAll('_', ' ')}</dd>
                </div>
                <div>
                  <dt>Start Date</dt>
                  <dd>{formatDate(contest.submissions_open_at)}</dd>
                </div>
                <div>
                  <dt>End Date</dt>
                  <dd>{formatDate(contest.voting_close_at)}</dd>
                </div>
                <div>
                  <dt>Nominees</dt>
                  <dd>{nominations.length}</dd>
                </div>
              </dl>
            </article>
          </aside>
        </div>
      </div>

      <div hidden={activeTab !== 'nominations'} aria-hidden={activeTab !== 'nominations'}>
        <div className={styles.nominationWorkbench}>
          <article className={styles.nominationCounter}>
            <div>
              <p className={styles.eyebrow}>Total Nominations</p>
              <div className={styles.bigNumber}>{nominations.length}</div>
            </div>
            <div className={styles.rankHint} aria-hidden="true">1 2 3</div>
          </article>

          <div className={styles.nominationToolbar}>
            <label className={styles.searchBox}>
              <span className={styles.searchLabel} aria-hidden="true">
                Search
              </span>
              <span className="sr-only">Search nominations</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search nominations..."
              />
            </label>
            <button
              type="button"
              className={styles.sortButton}
              onClick={cycleSort}
              aria-label={`Sort nominations by ${sort}`}
            >
              {sort}
            </button>
          </div>

          {sortedNominations.length === 0 ? (
            <p className={styles.emptyState}>
              {nominations.length === 0
                ? 'No approved nominees yet.'
                : 'No nominations match that search.'}
            </p>
          ) : (
            <div className={styles.rankedGallery}>
              {sortedNominations.map((nomination, index) => {
                const result = rankByNominationId.get(nomination.id)
                const rank = result?.final_rank ?? index + 1

                return (
                  <div key={nomination.id} className={styles.rankedNominee}>
                    <span className={styles.rankBadge}>{rank}</span>
                    <NomineeCard nomination={nomination} hideIdentity={hideIdentity} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div hidden={activeTab !== 'standing'} aria-hidden={activeTab !== 'standing'}>
        <div className={styles.standingStack}>
          <article className={styles.submitPanel}>
            <div className={styles.submitSeal} aria-hidden="true">*</div>
            <div>
              <p className={styles.eyebrow}>Submit a Nomination</p>
              <p className={styles.submitCopy}>
                {submissionsAreOpen
                  ? `Nominate ${allowedTypes.map(formatNomineeType).join(', ').toLowerCase() || 'an entry'} for this contest.`
                  : 'Submissions are closed for this contest.'}
              </p>
              {submissionsAreOpen ? (
                <Link
                  href={`/contests/${contest.slug}/submit`}
                  className={styles.brassButton}
                >
                  Submit Nomination
                </Link>
              ) : (
                <button
                  type="button"
                  className={`${styles.brassButton} ${styles.disabledAction}`}
                  disabled
                >
                  Submissions Closed
                </button>
              )}
            </div>
          </article>

          <article className={styles.acceptedPanel}>
            <p className={styles.eyebrow}>Your Nominations Accepted</p>
            <div className={styles.acceptedContent}>
              <span className={styles.checkShield} aria-hidden="true">OK</span>
              <p>
                <strong>{acceptedNominations.length}</strong>
                <span>
                  {' '}of your nominations {acceptedNominations.length === 1 ? 'was' : 'were'} accepted.
                </span>
              </p>
            </div>
          </article>

          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>My Nominations ({userNominations.length})</p>
            <div className={styles.standingRows}>
              {userNominations.length === 0 ? (
                <p className={styles.mutedText}>You have not submitted a nomination yet.</p>
              ) : (
                userNominations.map((nomination) => (
                  <StandingRow
                    key={nomination.id}
                    imageUrl={nomination.snapshot_image_url}
                    title={nomination.snapshot_title}
                    meta={getStatusLabel(nomination.status)}
                    href={`/contests/${contest.slug}`}
                  />
                ))
              )}
            </div>
          </article>

          <article className={styles.paperPanel}>
            <p className={styles.eyebrow}>My Ballots / Voting</p>
            <div className={styles.standingRows}>
              {ballot?.status === 'submitted' ? (
                <DisabledStandingRow
                  imageUrl={nominations.find((nomination) =>
                    ballot.contest_ballot_items?.some(
                      (item) => item.nomination_id === nomination.id
                    )
                  )?.snapshot_image_url}
                  title={`${ballot.contest_ballot_items?.length ?? 0} selections submitted`}
                  meta={
                    ballot.submitted_at
                      ? `Submitted on ${formatDate(ballot.submitted_at)}`
                      : 'Submitted'
                  }
                />
              ) : (
                <DisabledStandingRow
                  title={phase === 'voting_open' ? 'Cast your ballot' : 'No ballot submitted'}
                  meta={
                    phase === 'voting_open'
                      ? 'Voting controls are not available yet'
                      : 'Voting is not open'
                  }
                />
              )}
            </div>
          </article>

          <article className={styles.rankPanel}>
            <p className={styles.eyebrow}>My Rank</p>
            <div className={styles.rankValue}>
              {bestRank ? `#${bestRank}` : 'Pending'}
            </div>
            <p className={styles.mutedText}>
              {bestRank
                ? 'Your best accepted nomination has a published standing.'
                : 'Rank appears after results are finalized and visible.'}
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

function StandingRow({
  href,
  imageUrl,
  meta,
  title,
}: {
  href: string
  imageUrl?: string | null
  meta: string
  title: string
}) {
  return (
    <Link href={href} className={styles.standingRow}>
      {imageUrl ? (
        <span className={styles.standingThumb}>
          <Image src={imageUrl} alt="" fill sizes="72px" className="object-cover" />
        </span>
      ) : (
      <span className={styles.standingThumbFallback} aria-hidden="true">-</span>
      )}
      <span className={styles.standingText}>
        <span>{title}</span>
        <small>{meta}</small>
      </span>
      <span className={styles.chevron} aria-hidden="true">&gt;</span>
    </Link>
  )
}

function DisabledStandingRow({
  imageUrl,
  meta,
  title,
}: {
  imageUrl?: string | null
  meta: string
  title: string
}) {
  return (
    <div className={`${styles.standingRow} ${styles.standingRowDisabled}`}>
      {imageUrl ? (
        <span className={styles.standingThumb}>
          <Image src={imageUrl} alt="" fill sizes="72px" className="object-cover" />
        </span>
      ) : (
        <span className={styles.standingThumbFallback} aria-hidden="true">-</span>
      )}
      <span className={styles.standingText}>
        <span>{title}</span>
        <small>{meta}</small>
      </span>
      <span className={styles.chevron} aria-hidden="true">&gt;</span>
    </div>
  )
}
