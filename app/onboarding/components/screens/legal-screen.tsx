'use client'

import { useState } from 'react'
import TermsModal from './terms-modal'
import { acceptTermsAction } from '../../actions'
import styles from '../../../auth-flow-silver.module.css'

type Props = {
  onAccepted: () => void
  previewMode?: boolean
}

export default function LegalScreen({ onAccepted, previewMode = false }: Props) {
  const [accepted, setAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function continueAfterTerms() {
    if (!accepted || isSaving) return

    setIsSaving(true)
    setError(null)

    if (previewMode) {
      onAccepted()
      return
    }

    const result = await acceptTermsAction({
      productUpdatesApproved: marketingAccepted,
    })

    if (!result.ok) {
      setError(result.error ?? 'Could not save your acceptance. Please try again.')
      setIsSaving(false)
      return
    }

    onAccepted()
  }

  async function signOut() {
    const { createClient } = await import('../../../../utils/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <section className={styles.paperScreen}>
      <StepDots activeIndex={0} />

      <div className={`${styles.screenIntro} ${styles.screenIntroLarge}`}>
        <h1 className={styles.screenTitle}>
          Before we begin
        </h1>
        <p className={styles.screenCopy}>
          To use Obsidian Gallery, please review and accept the Terms and
          Conditions and Privacy Policy.
        </p>
      </div>

      <div className={styles.checkStack}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className={styles.checkbox}
          />

          <span>
            <span className="font-bold">I agree to the </span>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                setShowTerms(true)
              }}
              className={styles.textLink}
            >
              Terms and Conditions
            </button>
            <span className="font-bold"> and acknowledge the </span>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                setShowTerms(true)
              }}
              className={styles.textLink}
            >
              Privacy Policy.
            </button>
          </span>
        </label>

        <label className={`${styles.checkLabel} ${styles.mutedCheck}`}>
          <input
            type="checkbox"
            checked={marketingAccepted}
            onChange={(event) => setMarketingAccepted(event.target.checked)}
            className={styles.checkbox}
          />

          <span>
            Send me occasional product updates, painting inspiration and
            community news.
          </span>
        </label>
      </div>

      {error ? (
        <p className={`${styles.message} ${styles.messageError}`}>
          {error}
        </p>
      ) : null}

      <div className={styles.bottomActions}>
        <button
          type="button"
          disabled={!accepted || isSaving}
          onClick={continueAfterTerms}
          className={`tap-press tap-target ${styles.ctaButton}`}
        >
          {isSaving ? 'Saving...' : 'Accept and continue'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className={`tap-target ${styles.backButton}`}
        >
          Sign out
        </button>
      </div>

      {showTerms ? <TermsModal onClose={() => setShowTerms(false)} /> : null}
    </section>
  )
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className={styles.stepDots} aria-label="Onboarding step 1 of 3">
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
