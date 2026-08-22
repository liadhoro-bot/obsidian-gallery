'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { createOnboardingGuideAction } from '../../actions'
import styles from '../../../auth-flow-silver.module.css'

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
    <section className={styles.paperScreen}>
      <StepDots activeIndex={2} />

      <div className={`${styles.screenIntro} ${styles.screenIntroLarge}`}>
        <h1 className={styles.screenTitle}>
          Start with one guide
        </h1>
        <p className={styles.screenCopy}>
          Save the technique, recipe, or showcase idea you want to build first.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col">
        <label className={styles.uploadTray}>
          {imagePreview ? (
            <Image
              src={imagePreview}
              alt=""
              fill
              className={styles.previewImage}
              unoptimized
            />
          ) : null}

          <span className={styles.uploadIcon}>
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

          <span className={styles.uploadTitle}>
            Add a cover photo
          </span>
          <span className={styles.uploadHint}>
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

        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            Guide name
          </span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className={styles.input}
            placeholder="e.g. Grimdark brass armor, Snowy urban bases..."
          />
        </label>

        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            Notes
          </span>
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className={`${styles.textarea} resize-none`}
            placeholder="Optional: audience, paint list, process notes, or the finished look."
          />
        </label>

        {error ? (
          <p className={`${styles.message} ${styles.messageError}`}>
            {error}
          </p>
        ) : null}

        <div className={styles.bottomActions}>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`tap-press tap-target ${styles.ctaButton}`}
          >
            {isPending ? 'Creating...' : 'Build my first guide -&gt;'}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={onSkip}
            className={`tap-target ${styles.backButton}`}
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
    <div className={styles.stepDots} aria-label="Onboarding step 3 of 3">
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
