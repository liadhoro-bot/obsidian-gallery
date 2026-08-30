'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type {
  AchievementCollection,
  AchievementDisplay,
  AchievementTier,
} from '../../lib/achievements/types'
import { markAchievementsSeen } from './achievement-actions'
import styles from './dashboard-og.module.css'

const tierLabels: Record<AchievementTier, string> = {
  red: 'Red',
  silver: 'Silver',
  gold: 'Gold',
  prismatic: 'Special',
}

type AchievementFilter = AchievementTier | 'all' | 'earned'

const filters: AchievementFilter[] = [
  'all',
  'earned',
  'red',
  'silver',
  'gold',
  'prismatic',
]

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function SealImage({
  achievement,
  size = 'card',
}: {
  achievement: AchievementDisplay
  size?: 'hero' | 'card' | 'detail'
}) {
  if (!achievement.sealImageUrl) {
    return (
      <span
        className={styles.achievementSealFallback}
        data-size={size}
        aria-hidden="true"
      >
        <span />
      </span>
    )
  }

  return (
    <Image
      src={achievement.sealImageUrl}
      alt=""
      width={size === 'hero' ? 116 : size === 'detail' ? 138 : 82}
      height={size === 'hero' ? 116 : size === 'detail' ? 138 : 82}
      unoptimized
      className={styles.achievementSealImage}
      data-size={size}
      priority={size === 'hero'}
    />
  )
}

export default function AchievementCollectionClient({
  collection,
}: {
  collection: AchievementCollection
}) {
  const [isCollectionOpen, setIsCollectionOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<AchievementFilter>('all')
  const [selectedAchievement, setSelectedAchievement] =
    useState<AchievementDisplay | null>(null)
  const [, startTransition] = useTransition()
  const unseenIds = useMemo(
    () =>
      collection.unseenAchievements.map(
        (achievement) => achievement.achievementId
      ),
    [collection.unseenAchievements]
  )
  const featuredUnseen = collection.unseenAchievements[0] ?? null
  const additionalUnseenCount = Math.max(
    0,
    collection.unseenAchievements.length - 1
  )

  useEffect(() => {
    if (!unseenIds.length) return

    startTransition(async () => {
      await markAchievementsSeen(unseenIds)
    })
  }, [unseenIds])

  const visibleAchievements = collection.achievements.filter((achievement) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'earned') return achievement.earned
    return achievement.tier === activeFilter
  })
  const latest = featuredUnseen ?? collection.latestAchievement
  const previewAchievements = [...collection.achievements]
    .filter((achievement) => achievement.achievementId !== latest?.achievementId)
    .sort((first, second) => {
      if (first.earned && !second.earned) return -1
      if (!first.earned && second.earned) return 1

      if (first.earned && second.earned) {
        return (
          new Date(second.earnedAt ?? 0).getTime() -
          new Date(first.earnedAt ?? 0).getTime()
        )
      }

      return (second.progressPercent ?? 0) - (first.progressPercent ?? 0)
    })
    .slice(0, 3)

  return (
    <section
      className={styles.achievementPanel}
      data-v3-dashboard-indicator="achievement-collection"
    >
      <div className={styles.achievementHeader}>
        <div>
          <p className={styles.progressKicker}>Achievements</p>
          <h2 className={styles.progressLedgerTitle}>
            {collection.earnedCount} earned
          </h2>
        </div>
        <button
          type="button"
          className={styles.achievementOpenButton}
          onClick={() => setIsCollectionOpen(true)}
        >
          View all seals
        </button>
      </div>

      {latest ? (
        <button
          type="button"
          className={styles.latestAchievement}
          onClick={() => setSelectedAchievement(latest)}
        >
          <span className={styles.latestSealMount}>
            <SealImage achievement={latest} size="hero" />
          </span>
          <span className={styles.latestAchievementCopy}>
            <span className={styles.achievementEarnedLabel}>Latest Seal</span>
            <strong>{latest.name}</strong>
            <span>{latest.description}</span>
            <small>
              {tierLabels[latest.tier]}
              {latest.earnedAt ? ` - Earned ${formatDate(latest.earnedAt)}` : ''}
              {additionalUnseenCount
                ? ` - ${additionalUnseenCount} more newly earned`
                : ''}
            </small>
          </span>
        </button>
      ) : (
        <div className={styles.latestAchievementEmpty}>
          <span className={styles.achievementSealFallback} data-size="hero">
            <span />
          </span>
          <div>
            <p className={styles.achievementEarnedLabel}>No seals earned yet</p>
            <h3>The ledger is waiting.</h3>
            <p>Start a unit, log a session, or add paints to make the first mark.</p>
          </div>
        </div>
      )}

      {previewAchievements.length ? (
        <div className={styles.achievementPreviewRow}>
          {previewAchievements.map((achievement) => (
            <AchievementSmallCard
              key={achievement.achievementId}
              achievement={achievement}
              onClick={() => setSelectedAchievement(achievement)}
            />
          ))}
        </div>
      ) : null}

      {isCollectionOpen ? (
        <div
          className={styles.achievementDialogBackdrop}
          role="presentation"
          onClick={() => setIsCollectionOpen(false)}
        >
          <section
            className={styles.achievementCollectionDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievement-collection-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.achievementCollectionDialogHeader}>
              <div>
                <p className={styles.progressKicker}>Achievement Collection</p>
                <h3 id="achievement-collection-title">Available Seals</h3>
              </div>
              <button
                type="button"
                className={styles.achievementDialogClose}
                aria-label="Close achievement collection"
                onClick={() => setIsCollectionOpen(false)}
              >
                x
              </button>
            </div>

            <div
              className={styles.achievementTierSummary}
              aria-label="Tier summary"
            >
              {(['red', 'silver', 'gold', 'prismatic'] as AchievementTier[]).map(
                (tier) => (
                  <span key={tier}>
                    {tierLabels[tier]}{' '}
                    <strong>
                      {collection.tierSummary[tier].earned}/
                      {collection.tierSummary[tier].total}
                    </strong>
                  </span>
                )
              )}
            </div>

            <div
              className={styles.achievementFilters}
              role="tablist"
              aria-label="Achievement tiers"
            >
              {filters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
                  data-active={activeFilter === filter}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter === 'all'
                    ? 'All'
                    : filter === 'earned'
                      ? 'Earned'
                      : tierLabels[filter]}
                </button>
              ))}
            </div>

            {visibleAchievements.length ? (
              <div className={styles.achievementGrid}>
                {visibleAchievements.map((achievement) => (
                  <AchievementSmallCard
                    key={achievement.achievementId}
                    achievement={achievement}
                    onClick={() => setSelectedAchievement(achievement)}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.achievementEmptyState}>
                No achievement seals returned for this filter.
              </div>
            )}
          </section>
        </div>
      ) : null}

      {selectedAchievement ? (
        <div
          className={styles.achievementDialogBackdrop}
          role="presentation"
          onClick={() => setSelectedAchievement(null)}
        >
          <section
            className={styles.achievementDialog}
            data-earned={selectedAchievement.earned}
            data-tier={selectedAchievement.tier}
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievement-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.achievementDialogClose}
              aria-label="Close achievement details"
              onClick={() => setSelectedAchievement(null)}
            >
              x
            </button>
            <SealImage achievement={selectedAchievement} size="detail" />
            <p className={styles.achievementEarnedLabel}>
              {selectedAchievement.earned ? 'Earned Seal' : 'Locked Seal'}
            </p>
            <h3 id="achievement-detail-title">{selectedAchievement.name}</h3>
            <p>{selectedAchievement.description}</p>
            {selectedAchievement.curatorText ? (
              <em>&quot;{selectedAchievement.curatorText}&quot;</em>
            ) : null}
            <dl>
              <div>
                <dt>Tier</dt>
                <dd>{tierLabels[selectedAchievement.tier]}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {selectedAchievement.earned
                    ? `Earned ${formatDate(selectedAchievement.earnedAt)}`
                    : selectedAchievement.progressLabel ?? 'Locked'}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </section>
  )
}

function AchievementSmallCard({
  achievement,
  onClick,
}: {
  achievement: AchievementDisplay
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={styles.achievementCard}
      data-earned={achievement.earned}
      data-mystery-locked={achievement.isMysteryLocked}
      data-tier={achievement.tier}
      onClick={onClick}
    >
      <span className={styles.achievementCardSeal}>
        <SealImage achievement={achievement} />
      </span>
      <span className={styles.achievementCardCopy}>
        <strong>{achievement.name}</strong>
        <small>
          {achievement.earned
            ? 'Earned'
            : achievement.progressLabel ?? 'Locked'}
        </small>
      </span>
    </button>
  )
}
