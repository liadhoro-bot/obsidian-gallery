'use client'

import { useActionState } from 'react'
import SubmitButton from '../../components/SubmitButton'
import { rollCampaignDice, type DiceRollState } from './actions'

const initialDiceRollState: DiceRollState = {
  error: null,
  result: null,
}

function formatRollTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function RollResult({ state }: { state: DiceRollState }) {
  if (state.error) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
        {state.error}
      </div>
    )
  }

  if (!state.result) {
    return null
  }

  return (
    <section className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
        {state.result.duplicate ? 'Already recorded' : 'Roll recorded'}
      </p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3 text-center">
        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="text-4xl font-black tabular-nums">{state.result.dieOne}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            Die 1
          </div>
        </div>
        <div className="text-2xl font-black text-white/45">+</div>
        <div className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="text-4xl font-black tabular-nums">{state.result.dieTwo}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            Die 2
          </div>
        </div>
        <div className="text-2xl font-black text-white/45">=</div>
        <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
          <div className="text-5xl font-black tabular-nums text-emerald-100">
            {state.result.total}
          </div>
          <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200/70">
            Total
          </div>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-white/65 sm:grid-cols-2">
        <div>
          <dt className="font-bold text-white/40">Player</dt>
          <dd className="font-bold text-white">{state.result.playerName}</dd>
        </div>
        <div>
          <dt className="font-bold text-white/40">Reason</dt>
          <dd>{state.result.rollReason}</dd>
        </div>
        <div>
          <dt className="font-bold text-white/40">Recorded</dt>
          <dd>{formatRollTime(state.result.createdAt)}</dd>
        </div>
      </dl>
      {state.result.duplicate ? (
        <p className="mt-4 text-sm text-cyan-100/75">
          This player name already has a roll for that reason, so the original saved result is
          shown.
        </p>
      ) : null}
    </section>
  )
}

export default function DiceRollForm() {
  const [state, formAction] = useActionState(rollCampaignDice, initialDiceRollState)

  return (
    <div className="space-y-5">
      <form action={formAction} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <label className="block text-sm font-bold text-white/75" htmlFor="playerName">
          Campaign player name
        </label>
        <input
          id="playerName"
          name="playerName"
          type="text"
          minLength={2}
          maxLength={80}
          required
          autoComplete="name"
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-base font-bold text-white outline-none transition focus:border-cyan-300/70"
        />
        <label className="mt-5 block text-sm font-bold text-white/75" htmlFor="rollReason">
          Roll reason
        </label>
        <input
          id="rollReason"
          name="rollReason"
          type="text"
          minLength={3}
          maxLength={160}
          required
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-base font-bold text-white outline-none transition focus:border-cyan-300/70"
          placeholder="Example: Skeleton Chariots, veteran abilities roll +2XP"
        />
        <p className="mt-3 text-sm text-white/50">
          One saved 2d6 roll is allowed for each player name and reason. A new reason can be
          rolled separately.
        </p>
        <SubmitButton
          idleText="Roll 2d6"
          pendingText="Rolling..."
          className="mt-5 w-full rounded-lg border border-cyan-300/30 bg-cyan-300 px-5 py-3 font-black text-slate-950 shadow-lg shadow-cyan-950/30"
        />
      </form>

      <RollResult state={state} />
    </div>
  )
}
