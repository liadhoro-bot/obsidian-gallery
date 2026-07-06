'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { ContestNomination } from '../../lib/contests/types'
import DisplayModeToggle, { type DisplayMode } from '../display-mode-toggle'
import NomineeCard from './nominee-card'

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
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
      <div className="relative aspect-square bg-[#0b1622]">
        <Image
          src={nomination.snapshot_image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 33vw, 220px"
          className="object-cover"
        />
      </div>
      <div className="space-y-1 p-2">
        <h3 className="line-clamp-2 min-h-9 text-xs font-black leading-4 text-white">
          {nomination.snapshot_title}
        </h3>
        {!hideIdentity && nomination.snapshot_owner_display_name ? (
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
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
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
            Gallery
          </p>
          <h2 className="text-2xl font-black">Nominated Objects</h2>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center sm:justify-end">
          <DisplayModeToggle mode={mode} onModeChange={handleModeChange} />
          <label className="w-full sm:max-w-xs">
            <span className="sr-only">Search nominees</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                hideIdentity ? 'Search by name' : 'Search by name or nominator'
              }
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/35"
            />
          </label>
        </div>
      </div>

      {nominations.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No approved nominees yet.
        </p>
      ) : filteredNominations.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No nominated objects match that search.
        </p>
      ) : mode === 'tiles' ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {filteredNominations.map((nomination) => (
            <NomineeTile
              key={nomination.id}
              nomination={nomination}
              hideIdentity={hideIdentity}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
