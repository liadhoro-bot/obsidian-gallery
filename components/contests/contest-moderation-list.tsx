import type { ContestNomination } from '../../lib/contests/types'
import { moderateNominationAction } from '../../lib/contests/actions'
import NomineeCard from './nominee-card'

export default function ContestModerationList({
  contestId,
  nominations,
}: {
  contestId: string
  nominations: ContestNomination[]
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-black">Moderation</h2>
      {nominations.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
          No nominations yet.
        </p>
      ) : (
        nominations.map((nomination) => (
          <div
            key={nomination.id}
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[220px_1fr]"
          >
            <NomineeCard nomination={nomination} />
            <div className="space-y-3">
              <p className="text-sm text-white/55">
                Status: <span className="font-bold text-white">{nomination.status}</span>
              </p>
              {nomination.rejection_reason ? (
                <p className="text-sm text-red-200">{nomination.rejection_reason}</p>
              ) : null}
              <form action={moderateNominationAction} className="grid gap-2">
                <input type="hidden" name="contestId" value={contestId} />
                <input type="hidden" name="nominationId" value={nomination.id} />
                <textarea
                  name="reason"
                  placeholder="Reason, when rejecting or disqualifying"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    name="action"
                    value="approve"
                    className="rounded-xl bg-emerald-400 px-3 py-2 text-sm font-black text-black"
                  >
                    Approve
                  </button>
                  <button
                    name="action"
                    value="reject"
                    className="rounded-xl border border-amber-300/30 px-3 py-2 text-sm font-black text-amber-100"
                  >
                    Reject
                  </button>
                  <button
                    name="action"
                    value="disqualify"
                    className="rounded-xl border border-red-300/30 px-3 py-2 text-sm font-black text-red-100"
                  >
                    Disqualify
                  </button>
                  <button
                    name="action"
                    value="restore"
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-white/75"
                  >
                    Restore
                  </button>
                </div>
              </form>
            </div>
          </div>
        ))
      )}
    </section>
  )
}
