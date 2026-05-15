'use client'

import { useActionState, useEffect, useState } from 'react'
import SubmitButton from '../../../components/SubmitButton'
import {
  createOnboardingProject,
  type CreateOnboardingProjectState,
} from '../../actions'

type Props = {
  onCreated: () => void
  onSkip: () => void
}

const initialState: CreateOnboardingProjectState = {
  success: false,
  error: null,
}

const gameSystems = [
  'Warhammer 40K',
  'Age of Sigmar',
  'D&D Minis',
  'Gunpla',
  'Historical',
  'Other',
]

export default function FirstProjectScreen({ onCreated, onSkip }: Props) {
  const [state, formAction] = useActionState(
    createOnboardingProject,
    initialState
  )

  const [selectedSystem, setSelectedSystem] = useState<string | null>(null)

  useEffect(() => {
    if (state.success) {
      onCreated()
    }
  }, [state.success, onCreated])

  return (
    <section className="flex min-h-[520px] flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          First Project
        </div>

        <div className="space-y-3 pt-4">
          <h2 className="text-3xl font-black leading-tight text-white">
            Let’s start your
            <br />
            first army/project.
          </h2>

          <p className="max-w-sm text-base leading-7 text-white/60">
            Create your first project now, or skip and do it later from your
            dashboard.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Project name
          </label>

          <input
            name="name"
            required
            placeholder="Ultramarines 2nd Company"
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Description
          </label>

          <textarea
            name="description"
            rows={3}
            placeholder="What are you building or painting?"
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/40"
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Game system
          </div>

          <input type="hidden" name="game_system" value={selectedSystem ?? ''} />

          <div className="grid grid-cols-2 gap-2">
            {gameSystems.map((system) => {
              const isSelected = selectedSystem === system

              return (
                <button
                  key={system}
                  type="button"
                  onClick={() => setSelectedSystem(system)}
                  className={[
                    'rounded-2xl border px-3 py-3 text-left text-xs font-black transition',
                    isSelected
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.14)]'
                      : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')}
                >
                  {system}
                </button>
              )
            })}
          </div>

          <p className="mt-3 text-xs leading-5 text-white/35">
            We can save this later after adding a game_system column to projects.
          </p>
        </div>

        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-center text-sm font-bold text-white/40">
          Optional project photo later
        </div>

        {state.error ? (
          <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
            {state.error}
          </p>
        ) : null}

        <div className="grid grid-cols-[1fr_1.4fr] gap-3 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-black text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            Skip
          </button>

          <SubmitButton
            idleText="Create Project"
            pendingText="Creating..."
            className="h-12 rounded-2xl border border-cyan-400/30 bg-cyan-400/15 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400/20"
          />
        </div>
      </form>
    </section>
  )
}