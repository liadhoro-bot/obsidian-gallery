'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { createFirstProjectUnitAction } from '../../actions'
import styles from '../../../auth-flow-silver.module.css'

type FirstProjectScreenProps = {
  onCreated: (unitId: string | null) => void
  onSkip: () => void
  previewMode?: boolean
}

export default function FirstProjectScreen({
  onCreated,
  onSkip,
  previewMode = false,
}: FirstProjectScreenProps) {
  const [unitName, setUnitName] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [useDemo, setUseDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit = (unitName.trim().length > 1 || useDemo) && !isPending

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    const formData = new FormData(event.currentTarget)
    if (useDemo && !unitName.trim()) {
      formData.set('unitName', 'Demo Starter Miniature')
    }
    setError(null)

    if (previewMode) {
      onCreated(null)
      return
    }

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
    <section className={styles.paperScreen}>
      <StepDots activeIndex={2} />

      <div className={`${styles.screenIntro} ${styles.screenIntroLarge}`}>
        <h1 className={styles.screenTitle}>
          Let&apos;s start with one miniature
        </h1>
        <p className={styles.screenCopy}>
          Add the model you want to paint. We will help you decide what to do
          first.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col">
        <input type="hidden" name="projectName" value="Onboarding Bench" />

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
                d="M4.5 8.5A2.5 2.5 0 0 1 7 6h1.6l1.2-1.5h4.4L15.4 6H17a2.5 2.5 0 0 1 2.5 2.5V17A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17V8.5Z"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.6"
              />
              <path
                d="M12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </span>

          <span className={styles.uploadTitle}>
            Take or upload a photo
          </span>
          <span className={styles.uploadHint}>
            Optional - helps guide your experience
          </span>

          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>

        <label className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            What are you painting?
          </span>
          <input
            name="unitName"
            value={unitName}
            onChange={(event) => setUnitName(event.target.value)}
            required
            className={styles.input}
            placeholder="e.g. Space Marine Captain, Skeleton Warriors..."
          />
        </label>

        <label className={styles.inlineCheck}>
          <input
            type="checkbox"
            checked={useDemo}
            onChange={(event) => setUseDemo(event.target.checked)}
            className={styles.checkbox}
          />
          <span>I don&apos;t have a miniature ready - show me a demo</span>
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
            {isPending ? 'Creating...' : 'Show me my first step -&gt;'}
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={onSkip}
            className={`tap-target ${styles.backButton}`}
          >
            I&apos;ll add one later
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
