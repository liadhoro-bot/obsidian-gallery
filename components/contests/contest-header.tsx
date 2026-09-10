import Image from 'next/image'
import Link from 'next/link'
import { getContestCountdownTarget, getContestPhase } from '../../lib/contests/phases'
import type { Contest } from '../../lib/contests/types'
import ContestCountdown from './contest-countdown'
import ContestPhaseBadge from './contest-phase-badge'
import styles from './contest-v3-silver.module.css'

export default function ContestHeader({
  backHref,
  backLabel = 'Back',
  contest,
  manageHref,
  showFooter = true,
}: {
  backHref?: string
  backLabel?: string
  contest: Contest
  manageHref?: string
  showFooter?: boolean
}) {
  const phase = getContestPhase(contest)
  const countdownTarget = getContestCountdownTarget(contest, phase)
  const allowedTypes =
    contest.allowed_nominee_types?.map((row) => row.nominee_type).join(', ') ||
    'entries'
  const ctaHref =
    phase === 'submissions_open'
      ? `/contests/${contest.slug}/submit`
      : phase === 'voting_open'
        ? `/contests/${contest.slug}/vote`
        : phase === 'results_published'
          ? `/contests/${contest.slug}/results`
          : `/contests/${contest.slug}`
  const ctaLabel =
    phase === 'submissions_open'
      ? 'Submit a Nomination'
      : phase === 'voting_open'
        ? 'Cast My Votes'
        : phase === 'results_published'
          ? 'View Results'
          : 'View Details'

  return (
    <section className={styles.hero}>
      <div className={styles.heroImage}>
        {contest.cover_image_url ? (
          <Image
            src={contest.cover_image_url}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 760px"
            className={styles.heroMedia}
          />
        ) : null}
        <div className={styles.heroOverlay} />
        <div className={styles.heroTopBar}>
          {backHref ? (
            <Link href={backHref} className={styles.heroBackLink}>
              {backLabel}
            </Link>
          ) : (
            <span />
          )}
          <span className={styles.heroCountdownPill}>
            <span aria-hidden="true">◷</span>
            {formatRemaining(countdownTarget) || <ContestPhaseBadge phase={phase} />}
          </span>
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {contest.title}
          </h1>
          {contest.short_description ? (
            <p className={styles.heroSubtitle}>
              {contest.short_description}
            </p>
          ) : null}
        </div>
      </div>

      {showFooter ? (
        <div className={styles.headerFooter}>
        <div className={styles.headerMeta}>
          <ContestCountdown
            phase={phase}
            target={countdownTarget}
          />
          <p className={styles.acceptedTypes}>
            Accepting {allowedTypes.replaceAll('_', ' ')}
          </p>
        </div>
        <div className={styles.actionRow}>
          {manageHref ? (
            <Link
              href={manageHref}
              className={styles.secondaryAction}
            >
              Edit Contest
            </Link>
          ) : null}
          <Link
            href={ctaHref}
            className={styles.primaryAction}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
      ) : null}
    </section>
  )
}

function formatRemaining(target: string | null) {
  if (!target) return null
  const days = Math.max(
    0,
    Math.ceil((new Date(target).getTime() - Date.now()) / 86400000)
  )

  if (days === 0) return 'Today'
  if (days === 1) return '1 day left'
  return `${days} days left`
}
