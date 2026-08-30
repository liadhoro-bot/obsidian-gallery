'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { ContestNomination } from '../../lib/contests/types'
import DisplayModeToggle, { type DisplayMode } from '../display-mode-toggle'
import NomineeCard from './nominee-card'
import styles from './contest-v3-silver.module.css'

const STORAGE_KEY = 'og_contest_nominee_view_mode'

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'cards' || value === 'tiles'
}

function NomineeTile({
  nomination,
  hideIdentity,
}: {
  nomination: ContestNomination
  hideIdentity?: boolean
}) {
  return (
    <article className={styles.nomineeTile}>
      <div className={styles.nomineeTileImage}>
        <Image
          src={nomination.snapshot_image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, 220px"
          className="object-cover"
        />
      </div>
      <div className={styles.nomineeBody}>
        <h3 className={`${styles.tileTitle} line-clamp-2 min-h-9 text-xs leading-4`}>
          {nomination.snapshot_title}
        </h3>
        {!hideIdentity && nomination.snapshot_owner_display_name ? (
          <p className={`${styles.tileOwner} truncate text-[10px] font-bold uppercase tracking-[0.1em]`}>
            {nomination.snapshot_owner_display_name}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export default function ContestNomineeGallery({
  nominations,
  hideIdentity,
}: {
  nominations: ContestNomination[]
  hideIdentity?: boolean
}) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<DisplayMode>('cards')

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(STORAGE_KEY)
      if (isDisplayMode(storedMode)) {
        setMode(storedMode)
      }
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])
  const filteredNominations = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return nominations

    return nominations.filter((nomination) => {
      return (
        nomination.snapshot_title.toLowerCase().includes(needle) ||
        (nomination.snapshot_description ?? '').toLowerCase().includes(needle) ||
        (!hideIdentity &&
          (nomination.snapshot_owner_display_name ?? '')
            .toLowerCase()
            .includes(needle))
      )
    })
  }, [hideIdentity, nominations, search])

  function handleModeChange(nextMode: DisplayMode) {
    setMode(nextMode)
    window.localStorage.setItem(STORAGE_KEY, nextMode)
  }

  return (
    <section className={styles.galleryShell}>
      <div className={styles.galleryHead}>
        <div>
          <p className={styles.eyebrow}>Gallery</p>
          <h2 className={styles.sectionTitle}>Nominated Objects</h2>
        </div>
        <div className={styles.toolbar}>
          <DisplayModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            className={styles.displayModeToggle}
          />
          <label>
            <span className="sr-only">Search nominees</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                hideIdentity ? 'Search by name' : 'Search by name or nominator'
              }
              className={styles.searchInput}
            />
          </label>
        </div>
      </div>

      {nominations.length === 0 ? (
        <p className={styles.emptyState}>
          No approved nominees yet.
        </p>
      ) : filteredNominations.length === 0 ? (
        <p className={styles.emptyState}>
          No nominated objects match that search.
        </p>
      ) : mode === 'tiles' ? (
        <div className={styles.tileGrid}>
          {filteredNominations.map((nomination) => (
            <NomineeTile
              key={nomination.id}
              nomination={nomination}
              hideIdentity={hideIdentity}
            />
          ))}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredNominations.map((nomination) => (
            <NomineeCard
              key={nomination.id}
              nomination={nomination}
              hideIdentity={hideIdentity}
            />
          ))}
        </div>
      )}
    </section>
  )
}
