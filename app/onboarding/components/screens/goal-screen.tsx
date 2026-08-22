'use client'

import { useState, useTransition } from 'react'
import {
  saveOnboardingGoalAction,
  type OnboardingExperience,
  type OnboardingGoal,
} from '../../actions'
import styles from '../../../auth-flow-silver.module.css'

type GoalScreenProps = {
  onContinue: (goal: OnboardingGoal) => void
  previewMode?: boolean
}

const personaOptions: Array<{
  id: Exclude<OnboardingGoal, 'look_around'>
  title: string
  text: string
  cta: string
  icon: 'brush' | 'grid' | 'broadcast'
}> = [
  {
    id: 'paint_miniature',
    title: 'Help me paint a miniature',
    text: "I'm getting started or want clear, step-by-step guidance.",
    cta: 'Start my first miniature',
    icon: 'brush',
  },
  {
    id: 'organize_hobby',
    title: 'Help me organize my hobby',
    text: 'I want control over my projects, paints, progress and unfinished models.',
    cta: 'Organize my first unit',
    icon: 'grid',
  },
  {
    id: 'create_content',
    title: 'Help me create and share content',
    text: 'I publish tutorials, showcase my work or build an audience.',
    cta: 'Create my first guide',
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
    <section className={styles.paperScreen}>
      <StepDots activeIndex={1} />

      <div className={styles.screenIntro}>
        <h1 className={styles.screenTitle}>
          What would help you most right now?
        </h1>
        <p className={styles.screenCopy}>
          Choose where to begin. You can use everything else whenever you need it.
        </p>
      </div>

      <div className={styles.optionStack}>
        {personaOptions.map((option) => {
          const isSelected = selectedGoal === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedGoal(option.id)}
              className={[
                'tap-card',
                styles.personaCard,
                isSelected ? styles.personaCardActive : '',
              ].join(' ')}
            >
              <span
                className={styles.personaIcon}
              >
                <PersonaIcon icon={option.icon} className="h-6 w-6" />
              </span>

              <span className={styles.personaText}>
                <span className={styles.personaTitle}>
                  {option.title}
                </span>
                <span className={styles.personaDescription}>
                  {option.text}
                </span>
              </span>

              <span
                className={[
                  styles.radioMark,
                  isSelected ? styles.radioMarkActive : '',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <p className={styles.optionalLabel}>
          How experienced are you? optional
        </p>

        <div className={styles.chipRow}>
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
                  styles.choiceChip,
                  isSelected ? styles.choiceChipActive : '',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <p className={`${styles.message} ${styles.messageError}`}>
          {error}
        </p>
      ) : null}

      <div className={styles.bottomActions}>
        <button
          type="button"
          onClick={() => selectedGoal && saveAndContinue(selectedGoal)}
          disabled={!selectedGoal || isPending}
          className={`tap-press tap-target ${styles.ctaButton}`}
        >
          {isPending ? 'Saving...' : ctaLabel}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => saveAndContinue('look_around')}
          className={`tap-target ${styles.backButton}`}
        >
          Let me look around first
        </button>
      </div>
    </section>
  )
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className={styles.stepDots} aria-label="Onboarding step 2 of 3">
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className={[
            styles.stepDot,
            activeIndex === step ? styles.stepDotActive : '',
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
