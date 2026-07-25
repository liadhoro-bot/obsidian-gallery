'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { createOnboardingGuideAction } from '../../actions'

type GuideCreationScreenProps = {
  onCreated: (guideId: string | null) => void
  onSkip: () => void
  previewMode?: boolean
}

export default function GuideCreationScreen({
  onCreated,
  onSkip,
  previewMode = false,
}: GuideCreationScreenProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit = name.trim().length > 1 && !isPending

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    const formData = new FormData(event.currentTarget)
    setError(null)

    if (previewMode) {
      onCreated(null)
      return
    }

    startTransition(async () => {
      const result = await createOnboardingGuideAction(formData)

      if (!result.ok) {
        setError(result.error)
        return
      }

      onCreated(result.guideId)
    })
  }

  return (
    <section className="flex min-h-screen flex-col bg-[#05090a] px-4 pb-8 pt-9 text-white">
      <StepDots activeIndex={2} />

      <div className="mt-24 space-y-3">
        <h1 className="text-2xl font-black leading-tight">
          Start with one guide
        </h1>
        <p className="max-w-sm text-sm font-medium leading-6 text-white/55">
          Save the technique, recipe, or showcase idea you want to build first.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col">
        <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/16 bg-[#121923] px-5 py-6 text-center transition hover:border-violet-300/50 hover:bg-violet-300/[0.05]">
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt=""
              fill
              className="object-cover opacity-75"
              unoptimized
            />
          ) : null}

          <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/42">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M6 4.5h9.5L18 7v12.5H6V4.5Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="M9 10h6M9 13h6M9 16h4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
            </svg>
          </span>

          <span className="relative z-10 mt-4 text-sm font-black text-white/72">
            Add a cover photo
          </span>
          <span className="relative z-10 mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/45">
            Optional - useful for tutorials and showcases
          </span>

          <input
            name="coverImage"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>

        <label className="mt-8 block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            Guide name
          </span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#101722] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/26 focus:border-violet-300/55 focus:bg-[#121c29]"
            placeholder="e.g. Grimdark brass armor, Snowy urban bases..."
          />
        </label>

        <label className="mt-5 block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            Notes
          </span>
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-2xl border border-white/10 bg-[#101722] px-4 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-white/26 focus:border-violet-300/55 focus:bg-[#121c29]"
            placeholder="Optional: audience, paint list, process notes, or the finished look."
          />
        </label>

        {error ? (
          <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </p>
        ) : null}

        <div className="mt-auto space-y-4 pt-10">
          <button
            type="submit"
            disabled={!canSubmit}
            className="tap-press tap-target h-14 w-full rounded-2xl bg-cyan-400 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/28 disabled:shadow-none"
          >
            {isPending ? 'Creating...' : 'Build my first guide -&gt;'}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={onSkip}
            className="tap-target mx-auto block rounded-full px-4 py-2 text-sm font-bold text-white/40 transition hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            I&apos;ll create it later
          </button>
        </div>
      </form>
    </section>
  )
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex gap-2" aria-label="Onboarding step 3 of 3">
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className={[
            'h-2 rounded-full transition-all',
            activeIndex === step
              ? 'w-4 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
              : 'w-2 bg-white/18',
          ].join(' ')}
        />
      ))}
    </div>
  )
}
