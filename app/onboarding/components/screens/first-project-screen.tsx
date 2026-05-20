'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import { createFirstProjectUnitAction } from '../../actions'

type FirstProjectScreenProps = {
  onCreated: (unitId: string) => void
  onBack: () => void
  onSkip: () => void
}

export default function FirstProjectScreen({
  onCreated,
  onBack,
  onSkip,
}: FirstProjectScreenProps) {

  const [projectName, setProjectName] = useState('')
  const [unitName, setUnitName] = useState('')
  const [deadline, setDeadline] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit =
    projectName.trim().length > 1 &&
    unitName.trim().length > 1 &&
    deadline.trim().length > 0

  const formattedDeadline = useMemo(() => {
    if (!deadline) return 'Choose a finish date'

    try {
      return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(`${deadline}T12:00:00`))
    } catch {
      return 'Choose a finish date'
    }
  }, [deadline])

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      setImagePreview(null)
      return
    }

    setImagePreview(URL.createObjectURL(file))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit || isPending) return

    const formData = new FormData(event.currentTarget)
    setError(null)

    startTransition(async () => {
      const result = await createFirstProjectUnitAction(formData)

      if (!result.ok) {
        setError(result.error)
        return
      }

      onCreated(result.unitId)
    })
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#05080d] px-5 pb-8 pt-8 text-white">
      <div className="absolute inset-0">
        <Image
          src="/onboarding/first-project-bg.jpeg"
          alt=""
          fill
          priority
          className="object-cover opacity-45"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-[#05080d]/50 via-[#05080d]/82 to-[#05080d]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_42%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#05080d] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col">
        <div className="absolute left-0 right-0 top-1 flex items-center justify-center gap-2">
          {[0, 1, 2, 3].map((step) => {
            const isActive = step === 3

            return (
              <span
                key={step}
                className={
                  isActive
                    ? 'h-2 w-7 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.75)]'
                    : 'h-2 w-2 rounded-full bg-white/25'
                }
              />
            )
          })}
        </div>

        <header className="space-y-3 pt-12 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 shadow-lg shadow-cyan-950/30 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
              Your First Mission
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-black leading-[0.95] tracking-tight text-white drop-shadow-2xl">
              Start with the model on your table.
            </h1>

            <p className="mx-auto max-w-sm text-sm leading-6 text-white/75">
              Create your first project and unit. We’ll use it to build your
              dashboard, track progress, and keep your brush moving.
            </p>

            <p className="mx-auto max-w-xs text-xs font-medium leading-5 text-cyan-50/55">
              No grand army plan required. Just the next thing you want
              finished.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div className="rounded-[2rem] border border-white/14 bg-black/35 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                  <span className="text-cyan-300">▱</span>
                  Project Name
                </span>

                <input
                  name="projectName"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Your Army. Example: Tyranid Hive Fleet Kraken"
                  required
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:bg-white/[0.12]"
                />
              </label>

              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                  <span className="text-cyan-300">✦</span>
                  Unit Name
                </span>

                <input
                  name="unitName"
                  value={unitName}
                  onChange={(event) => setUnitName(event.target.value)}
                  placeholder="Example: Winged Tyranid Prime"
                  required
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/60 focus:bg-white/[0.12]"
                />
              </label>

              <div className="space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                  <span className="text-cyan-300">▧</span>
                  Unit Image
                  <span className="tracking-normal text-white/30">
                    optional
                  </span>
                </span>

                <div className="flex gap-3">
                  <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-cyan-300/35 bg-cyan-300/[0.06] text-3xl font-light text-cyan-200 transition hover:border-cyan-200 hover:bg-cyan-300/[0.12]">
                    {imagePreview ? (
                      <Image
                        src={imagePreview}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    ) : (
                      '+'
                    )}

                    <input
                      name="image"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                  </label>

                  <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4">
                    <p className="text-xs leading-5 text-white/48">
                      Upload a photo now to create a stunning unit showcase card - and transform its colors into a reusable hobby theme.
                    </p>
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                  <span className="text-cyan-300">◴</span>
                  Deadline
                </span>

                <input
                  name="deadline"
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/12 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/60 focus:bg-white/[0.12]"
                />
              </label>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[#061018] p-5 shadow-xl shadow-cyan-950/20">
  <div className="absolute inset-0">
    {imagePreview ? (
      <Image
        src={imagePreview}
        alt=""
        fill
        className="object-cover opacity-65"
      />
    ) : (
      <Image
        src="/onboarding/first-project-bg.jpeg"
        alt=""
        fill
        className="object-cover opacity-35"
      />
    )}

    <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
<div className="absolute inset-0 bg-gradient-to-t from-[#061018]/85 via-[#061018]/15 to-transparent" />
  </div>

  <div className="relative z-10 min-h-[210px]">
    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
      {projectName.trim() || 'Your First Project'}
    </p>

    <h3 className="mt-2 max-w-[260px] text-2xl font-black leading-tight text-white">
      {unitName.trim() || 'Your First Unit'}
    </h3>

    <div className="mt-5 grid grid-cols-2 gap-2">
      <div className="rounded-2xl border border-orange-300/20 bg-orange-300/10 px-3 py-2 backdrop-blur-0">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-200/70">
          Deadline
        </p>
        <p className="mt-1 text-sm font-black text-orange-300">
          {formattedDeadline}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-0">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
          Last Session
        </p>
        <p className="mt-1 text-sm font-bold text-white/75">
          Not started
        </p>
      </div>
    </div>

    <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] p-3 backdrop-blur-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
          Progress
        </p>
        <p className="text-sm font-black text-cyan-200">0%</p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-0 rounded-full bg-cyan-300" />
      </div>
    </div>
  </div>
</div>
          {error ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
              {error}
            </div>
          ) : null}

          <div className="space-y-3 pb-8">
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="group relative w-full overflow-hidden rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#041016] shadow-xl shadow-cyan-500/25 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/30 disabled:shadow-none"
            >
              <span className="relative z-10">
                {isPending ? 'Creating Workshop...' : 'Create My First Unit'}
              </span>

              <span className="relative z-10 ml-3 text-lg">→</span>

              <span className="absolute inset-0 translate-x-[-120%] bg-white/35 blur-xl transition duration-700 group-hover:translate-x-[120%]" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-black text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Back
                </button>
              ) : (
                <div />
              )}

              {onSkip ? (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-black text-white/60 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Skip
                </button>
              ) : (
                <div />
              )}
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}