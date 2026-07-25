'use client'

import { useState, useTransition } from 'react'
import {
  saveOnboardingGoalAction,
  type OnboardingExperience,
  type OnboardingGoal,
} from '../../actions'

type GoalScreenProps = {
  onContinue: (goal: OnboardingGoal) => void
  previewMode?: boolean
}

const personaOptions: Array<{
  id: Exclude<OnboardingGoal, 'look_around'>
  title: string
  text: string
  cta: string
  tone: string
  ring: string
  icon: 'brush' | 'grid' | 'broadcast'
}> = [
  {
    id: 'paint_miniature',
    title: 'Help me paint a miniature',
    text: "I'm getting started or want clear, step-by-step guidance.",
    cta: 'Start my first miniature',
    tone: 'bg-cyan-300/12 text-cyan-300',
    ring: 'border-cyan-300/60 bg-cyan-300/[0.08]',
    icon: 'brush',
  },
  {
    id: 'organize_hobby',
    title: 'Help me organize my hobby',
    text: 'I want control over my projects, paints, progress and unfinished models.',
    cta: 'Organize my first unit',
    tone: 'bg-sky-300/12 text-sky-300',
    ring: 'border-sky-300/55 bg-sky-300/[0.07]',
    icon: 'grid',
  },
  {
    id: 'create_content',
    title: 'Help me create and share content',
    text: 'I publish tutorials, showcase my work or build an audience.',
    cta: 'Create my first guide',
    tone: 'bg-violet-300/14 text-violet-200',
    ring: 'border-violet-300/55 bg-violet-300/[0.08]',
    icon: 'broadcast',
  },
]

const experienceOptions: Array<{
  id: OnboardingExperience
  label: string
}> = [
  { id: 'just_starting', label: 'Just starting' },
  { id: 'know_basics', label: 'Know the basics' },
  { id: 'experienced', label: 'Experienced' },
  { id: 'professional', label: 'Professional' },
]

export default function GoalScreen({
  onContinue,
  previewMode = false,
}: GoalScreenProps) {
  const [selectedGoal, setSelectedGoal] = useState<OnboardingGoal | null>(null)
  const [experience, setExperience] = useState<OnboardingExperience | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedPersona = personaOptions.find(
    (option) => option.id === selectedGoal
  )
  const ctaLabel = selectedPersona?.cta ?? 'Choose an option above'

  function saveAndContinue(goal: OnboardingGoal) {
    if (isPending) return

    setError(null)

    if (previewMode) {
      onContinue(goal)
      return
    }

    startTransition(async () => {
      const result = await saveOnboardingGoalAction(goal, experience)

      if (!result.ok) {
        setError(result.error ?? 'Could not save your answer.')
        return
      }

      onContinue(goal)
    })
  }

  return (
    <section className="flex min-h-screen flex-col bg-[#05090a] px-4 pb-8 pt-9 text-white">
      <StepDots activeIndex={1} />

      <div className="mt-6 space-y-2">
        <h1 className="max-w-xs text-[1.75rem] font-black leading-[1.02]">
          What would help you most right now?
        </h1>
        <p className="max-w-sm text-sm font-medium leading-6 text-white/50">
          Choose where to begin. You can use everything else whenever you need it.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {personaOptions.map((option) => {
          const isSelected = selectedGoal === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedGoal(option.id)}
              className={[
                'grid min-h-[78px] w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99]',
                isSelected
                  ? option.ring
                  : 'border-white/6 bg-[#111821] hover:border-white/16 hover:bg-[#151d28]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-2xl',
                  option.tone,
                ].join(' ')}
              >
                <PersonaIcon icon={option.icon} className="h-6 w-6" />
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-black leading-5 text-white">
                  {option.title}
                </span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-white/43">
                  {option.text}
                </span>
              </span>

              <span
                className={[
                  'h-5 w-5 rounded-full border transition',
                  isSelected
                    ? 'border-cyan-300 bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.55)]'
                    : 'border-white/20',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          How experienced are you? optional
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {experienceOptions.map((option) => {
            const isSelected = experience === option.id

            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  setExperience((current) =>
                    current === option.id ? null : option.id
                  )
                }
                className={[
                  'rounded-full px-3 py-2 text-xs font-black transition',
                  isSelected
                    ? 'bg-cyan-300 text-black'
                    : 'bg-white/[0.07] text-white/45 hover:bg-white/[0.11] hover:text-white/65',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-auto space-y-4 pt-8">
        <button
          type="button"
          onClick={() => selectedGoal && saveAndContinue(selectedGoal)}
          disabled={!selectedGoal || isPending}
          className="tap-press tap-target h-14 w-full rounded-2xl bg-cyan-400 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/28 disabled:shadow-none"
        >
          {isPending ? 'Saving...' : ctaLabel}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => saveAndContinue('look_around')}
          className="tap-target mx-auto block rounded-full px-4 py-2 text-sm font-bold text-white/40 transition hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Let me look around first
        </button>
      </div>
    </section>
  )
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex gap-2" aria-label="Onboarding step 2 of 3">
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

function PersonaIcon({
  icon,
  className,
}: {
  icon: (typeof personaOptions)[number]['icon']
  className: string
}) {
  if (icon === 'brush') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path
          d="m14.5 6.5 3-3a2.1 2.1 0 0 1 3 3l-3 3M13.2 7.8l3 3-7.55 7.55c-.8.8-1.88 1.25-3 1.25H3.8v-1.85c0-1.12.45-2.2 1.25-3L13.2 7.8Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    )
  }

  if (icon === 'grid') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
        <path
          d="M5 5h5v5H5V5ZM14 5h5v5h-5V5ZM5 14h5v5H5v-5ZM14 14h5v5h-5v-5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 13.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M7.9 7.3a6.1 6.1 0 0 0 0 8.6M16.1 7.3a6.1 6.1 0 0 1 0 8.6M4.9 4.4a10.4 10.4 0 0 0 0 15.2M19.1 4.4a10.4 10.4 0 0 1 0 15.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
