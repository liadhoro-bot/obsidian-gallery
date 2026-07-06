'use client'

import { useMemo, useState } from 'react'
import type { Contest, ContestNomination } from '../../lib/contests/types'
import NomineeCard from './nominee-card'
import BallotBar from './ballot-bar'

export default function RankedBallot({
  contest,
  nominations,
  action,
}: {
  contest: Contest
  nominations: ContestNomination[]
  action: (formData: FormData) => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const exact = contest.require_exact_selection_count
  const canSubmit = exact
    ? selectedIds.length === contest.maximum_selections_per_ballot
    : selectedIds.length >= contest.minimum_selections_per_ballot &&
      selectedIds.length <= contest.maximum_selections_per_ballot

  function toggle(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((value) => value !== id)
      }
      if (current.length >= contest.maximum_selections_per_ballot) {
        return current
      }
      return [...current, id]
    })
  }

  function move(id: string, direction: -1 | 1) {
    setSelectedIds((current) => {
      const index = current.indexOf(id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="contestId" value={contest.id} />
      <input type="hidden" name="slug" value={contest.slug} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="nominationIds" value={id} />
      ))}

      {selectedIds.length > 0 ? (
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-cyan-100">
            Ranked Ballot
          </h2>
          <div className="mt-3 space-y-2">
            {selectedIds.map((id, index) => {
              const nomination = nominations.find((item) => item.id === id)
              if (!nomination) return null
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-2"
                >
                  <span className="w-8 text-center text-sm font-black text-cyan-200">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {nomination.snapshot_title}
                  </span>
                  <button type="button" onClick={() => move(id, -1)} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                    Up
                  </button>
                  <button type="button" onClick={() => move(id, 1)} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                    Down
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {nominations.map((nomination) => (
          <NomineeCard
            key={nomination.id}
            nomination={nomination}
            hideIdentity={contest.hide_nominee_identity_during_voting}
            control={
              <button
                type="button"
                onClick={() => toggle(nomination.id)}
                className={`rounded-lg px-3 py-2 text-xs font-black ${
                  selectedSet.has(nomination.id)
                    ? 'bg-cyan-400 text-black'
                    : 'border border-white/10 text-white/70'
                }`}
              >
                {selectedSet.has(nomination.id)
                  ? `Rank ${selectedIds.indexOf(nomination.id) + 1}`
                  : 'Rank'}
              </button>
            }
          />
        ))}
      </div>

      <BallotBar
        selectedCount={selectedIds.length}
        minimum={contest.minimum_selections_per_ballot}
        maximum={contest.maximum_selections_per_ballot}
        exact={contest.require_exact_selection_count}
        disabled={!canSubmit}
      />
    </form>
  )
}
