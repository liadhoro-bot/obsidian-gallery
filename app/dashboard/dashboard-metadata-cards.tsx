'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import styles from './dashboard-og.module.css'

const STORAGE_KEY = 'obsidian-gallery:hidden-dashboard-metadata'
const STORAGE_CHANGE_EVENT = 'dashboard-metadata-visibility-change'

export type DashboardMetadataItem = {
  id: string
  label: string
  value: string
  accent: 'neutral' | 'warm'
}

export type DashboardPaintStreakCardProps = {
  paintStreak: string
  sessionLabel: string
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

function StreakIcon() {
  return (
    <svg
      className={styles.streakIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M12 3c1.7 2.4 4.5 5.4 4.5 9a4.5 4.5 0 0 1-9 0C7.5 8.4 10.3 5.4 12 3Z" />
      <path d="M9.9 13.2c.5 1.2 1.3 1.8 2.1 1.8s1.6-.6 2.1-1.8" />
    </svg>
  )
}

export function DashboardPaintStreakCard({
  paintStreak,
  sessionLabel,
}: DashboardPaintStreakCardProps) {
  return (
    <section className={styles.paintStreakCard}>
      <div className={styles.paintStreakCopy}>
        <span className={styles.streakIconPlate}>
          <StreakIcon />
        </span>
        <div>
          <p className={styles.profileSectionEyebrow}>Paint Streak</p>
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
        <h2 className={styles.profileSectionTitle}>Stats</h2>
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
              data-editing={isEditing}
              data-hidden={isHidden}
              data-tone={item.accent}
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
              <p className={styles.metadataValue}>{item.value}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
