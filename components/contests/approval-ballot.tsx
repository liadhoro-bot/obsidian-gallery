'use client'

import { useMemo, useState } from 'react'
import type { Contest, ContestNomination } from '../../lib/contests/types'
import BallotBar from './ballot-bar'
import NomineeCard from './nominee-card'

export default function ApprovalBallot({
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
      if (current.includes(id)) return current.filter((value) => value !== id)
      if (current.length >= contest.maximum_selections_per_ballot) return current
      return [...current, id]
    })
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="contestId" value={contest.id} />
      <input type="hidden" name="slug" value={contest.slug} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="nominationIds" value={id} />
      ))}

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
                {selectedSet.has(nomination.id) ? 'Selected' : 'Select'}
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
