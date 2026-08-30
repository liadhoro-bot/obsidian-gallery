'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import styles from './dashboard-og.module.css'

const STORAGE_KEY = 'obsidian-gallery:hidden-dashboard-metadata'
const STORAGE_CHANGE_EVENT = 'dashboard-metadata-visibility-change'

export type DashboardMetadataItem = {
  id: string
  label: string
  value: string
  accent: string
  paintingTimeBuckets?: Array<{
    id: string
    label: string
    count: number
    percent: number
    color: string
  }>
}

function parseHiddenItemIds(value: string | null) {
  if (!value) return []

  try {
    const parsedValue = JSON.parse(value)
    if (Array.isArray(parsedValue)) {
      return parsedValue.filter(
        (itemId): itemId is string => typeof itemId === 'string'
      )
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
  }

  return []
}

function subscribeToHiddenItems(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange)
  }
}

function getHiddenItemSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? '[]'
}

function getServerHiddenItemSnapshot() {
  return '[]'
}

function saveHiddenItemIds(itemIds: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itemIds))
  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT))
}

function MetadataVisibilityIcon({ isHidden }: { isHidden: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
      {isHidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}

function PaintingTimesChart({
  buckets,
}: {
  buckets: NonNullable<DashboardMetadataItem['paintingTimeBuckets']>
}) {
  const gradientStops = buckets
    .reduce(
      (stops, bucket) => {
        const start = stops.cursor
        const end = start + bucket.percent
        return {
          cursor: end,
          values: [
            ...stops.values,
            `${bucket.color} ${start}% ${Math.min(100, end)}%`,
          ],
        }
      },
      { cursor: 0, values: [] as string[] }
    )
    .values.join(', ')

  return (
    <div className={styles.paintingTimesCardContent}>
      <div
        className={styles.paintingTimesPie}
        style={{ background: `conic-gradient(${gradientStops})` }}
        aria-hidden="true"
      >
        <span>{buckets.reduce((sum, bucket) => sum + bucket.count, 0)}</span>
      </div>
      <div className={styles.paintingTimesLegend}>
        {buckets.map((bucket) => (
          <div key={bucket.id} className={styles.paintingTimesLegendRow}>
            <span
              className={styles.paintingTimesSwatch}
              style={{ backgroundColor: bucket.color }}
            />
            <span>{bucket.label}</span>
            <strong>{bucket.percent}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardMetadataCards({
  items,
}: {
  items: DashboardMetadataItem[]
}) {
  const [isEditing, setIsEditing] = useState(false)
  const hiddenItemSnapshot = useSyncExternalStore(
    subscribeToHiddenItems,
    getHiddenItemSnapshot,
    getServerHiddenItemSnapshot
  )
  const hiddenItemIds = useMemo(
    () => parseHiddenItemIds(hiddenItemSnapshot),
    [hiddenItemSnapshot]
  )
  const validHiddenItemIds = useMemo(() => {
    const itemIds = new Set(items.map((item) => item.id))
    return hiddenItemIds.filter((itemId) => itemIds.has(itemId))
  }, [hiddenItemIds, items])

  const visibleItems = useMemo(() => {
    if (isEditing) return items
    return items.filter((item) => !validHiddenItemIds.includes(item.id))
  }, [isEditing, items, validHiddenItemIds])

  const visibleItemCount = items.length - validHiddenItemIds.length

  function toggleItem(itemId: string) {
    if (validHiddenItemIds.includes(itemId)) {
      saveHiddenItemIds(
        validHiddenItemIds.filter((hiddenItemId) => hiddenItemId !== itemId)
      )
      return
    }

    if (visibleItemCount <= 1) {
      return
    }

    saveHiddenItemIds([...validHiddenItemIds, itemId])
  }

  return (
    <section className={styles.metadataPanel}>
      <div className={styles.metadataHeader}>
        <div>
          <p className={styles.profileSectionEyebrow}>Bench Record</p>
          <h2 className={styles.profileSectionTitle}>Metadata</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className={styles.metadataEditButton}
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className={styles.metadataGrid}>
        {visibleItems.map((item) => {
          const isHidden = validHiddenItemIds.includes(item.id)
          const canHide = !isHidden && visibleItemCount <= 1

          return (
            <button
              key={item.id}
              type="button"
              onClick={isEditing ? () => toggleItem(item.id) : undefined}
              disabled={!isEditing || canHide}
              aria-pressed={isEditing ? !isHidden : undefined}
              className={styles.metadataCard}
              data-chart={item.paintingTimeBuckets ? 'painting-times' : undefined}
              data-editing={isEditing}
              data-hidden={isHidden}
              data-tone={item.accent === 'text-orange-400' ? 'warm' : 'neutral'}
            >
              <div className={styles.metadataCardTopline}>
                <p>{item.label}</p>
                {isEditing ? (
                  <span
                    className={styles.metadataVisibilityIcon}
                    data-hidden={isHidden}
                    aria-hidden="true"
                  >
                    <MetadataVisibilityIcon isHidden={isHidden} />
                  </span>
                ) : null}
              </div>
              {item.paintingTimeBuckets ? (
                <PaintingTimesChart buckets={item.paintingTimeBuckets} />
              ) : (
                <p className={styles.metadataValue}>{item.value}</p>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function DashboardPaintStreakCard({
  paintStreak,
  sessionLabel,
}: {
  paintStreak: string
  sessionLabel: string
}) {
  return (
    <section className={styles.paintStreakCard}>
      <div className={styles.paintStreakCopy}>
        <span className={styles.streakIconPlate} aria-hidden="true">
          <svg className={styles.streakIcon} viewBox="0 0 24 24" fill="none">
            <path d="M12 3c2.2 2.2 4.5 5.5 4.5 9a4.5 4.5 0 0 1-9 0c0-3.5 2.3-6.8 4.5-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
            <path d="M10.2 14.3c.8.8 2.8.8 3.6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        </span>
        <div>
          <p className={styles.progressKicker}>Paint Streak</p>
          <h2>{paintStreak}</h2>
        </div>
      </div>
      <div className={styles.lastSessionBlock}>
        <p>Last Session</p>
        <span>{sessionLabel}</span>
      </div>
    </section>
  )
}
