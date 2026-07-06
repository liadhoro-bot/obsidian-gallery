import {
  addContestAllowlistUsersAction,
  removeContestAllowlistUserAction,
  removeContestParticipantAction,
} from '../../lib/contests/actions'
import type { ContestInvitedParticipant } from '../../lib/contests/types'
import PendingSubmitButton from './pending-submit-button'

export default function ContestAllowlistManager({
  contestId,
  allowlist,
  participants = [],
}: {
  contestId: string
  allowlist: { user_id: string; created_at: string }[]
  participants?: ContestInvitedParticipant[]
}) {
  const participantUserIds = new Set(
    participants.map((participant) => participant.user_id).filter(Boolean)
  )
  const extraAllowlist = allowlist.filter(
    (entry) => !participantUserIds.has(entry.user_id)
  )

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-xl font-black">Eligible Participants</h2>
      <p className="mt-2 text-sm leading-6 text-white/55">
        Add emails or usernames for closed contests. Existing users are matched
        into the voting allowlist; future users remain pending here.
      </p>

      <form action={addContestAllowlistUsersAction} className="mt-3 grid gap-2">
        <input type="hidden" name="contestId" value={contestId} />
        <textarea
          name="emails"
          rows={4}
          placeholder="player@email.com, @username, another@email.com"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white"
        />
        <PendingSubmitButton
          pendingLabel="Adding..."
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-black"
        >
          Add Participants
        </PendingSubmitButton>
      </form>

      <div className="mt-4 space-y-2">
        {participants.length === 0 && extraAllowlist.length === 0 ? (
          <p className="text-sm text-white/45">No eligible participants yet.</p>
        ) : null}

        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white/80">
                {participant.email || `@${participant.username}` || participant.identifier}
              </div>
              <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                {participant.status === 'matched' ? 'Matched app user' : 'Pending signup'}
              </div>
            </div>
            <form action={removeContestParticipantAction}>
              <input type="hidden" name="contestId" value={contestId} />
              <input type="hidden" name="participantId" value={participant.id} />
              <input type="hidden" name="userId" value={participant.user_id ?? ''} />
              <PendingSubmitButton
                pendingLabel="Removing..."
                className="rounded-lg border border-red-300/25 px-3 py-1 text-xs font-bold text-red-100"
              >
                Remove
              </PendingSubmitButton>
            </form>
          </div>
        ))}

        {extraAllowlist.map((entry) => (
          <div
            key={entry.user_id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white/80">
                {entry.user_id}
              </div>
              <div className="text-xs uppercase tracking-[0.14em] text-white/35">
                Allowlisted user
              </div>
            </div>
            <form action={removeContestAllowlistUserAction}>
              <input type="hidden" name="contestId" value={contestId} />
              <input type="hidden" name="userId" value={entry.user_id} />
              <PendingSubmitButton
                pendingLabel="Removing..."
                className="rounded-lg border border-red-300/25 px-3 py-1 text-xs font-bold text-red-100"
              >
                Remove
              </PendingSubmitButton>
            </form>
          </div>
        ))}
      </div>
    </section>
  )
}
