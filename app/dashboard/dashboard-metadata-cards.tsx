'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'obsidian-gallery:hidden-dashboard-metadata'
const STORAGE_CHANGE_EVENT = 'dashboard-metadata-visibility-change'

export type DashboardMetadataItem = {
  id: string
  label: string
  value: string
  accent: string
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
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
          Metadata
        </h2>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="tap-press rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 hover:text-cyan-200 active:scale-[0.98]"
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
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
              className={[
                'min-h-[86px] rounded-xl border border-white/10 bg-white/5 p-3 text-left transition',
                isEditing
                  ? 'cursor-pointer hover:border-cyan-300/45 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'cursor-default',
                isHidden ? 'opacity-45' : 'opacity-100',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-1.5">
                <p className="min-w-0 text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/45">
                  {item.label}
                </p>
                {isEditing ? (
                  <span
                    className={[
                      'mt-0.5 flex-none',
                      isHidden ? 'text-white/25' : 'text-cyan-200',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    <MetadataVisibilityIcon isHidden={isHidden} />
                  </span>
                ) : null}
              </div>
              <p className={`mt-2 text-xl font-semibold leading-none ${item.accent}`}>
                {item.value}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}
