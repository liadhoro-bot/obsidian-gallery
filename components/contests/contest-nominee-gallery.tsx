'use client'

import { useMemo, useState } from 'react'
import type { ContestNomination } from '../../lib/contests/types'
import NomineeCard from './nominee-card'

export default function ContestNomineeGallery({
  nominations,
  hideIdentity,
}: {
  nominations: ContestNomination[]
  hideIdentity?: boolean
}) {
  const [search, setSearch] = useState('')
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

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
            Gallery
          </p>
          <h2 className="text-2xl font-black">Nominated Objects</h2>
        </div>
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

      {nominations.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No approved nominees yet.
        </p>
      ) : filteredNominations.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No nominated objects match that search.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
