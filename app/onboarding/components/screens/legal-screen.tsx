'use client'

import { useState } from 'react'
import TermsModal from './terms-modal'
import { acceptTermsAction } from '../../actions'

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
    <section className="flex min-h-screen flex-col bg-[#05090a] px-4 pb-8 pt-9 text-white">
      <StepDots activeIndex={0} />

      <div className="mt-36 space-y-4">
        <h1 className="text-2xl font-black leading-tight">
          Before we begin
        </h1>
        <p className="max-w-sm text-sm font-medium leading-6 text-white/60">
          To use Obsidian Gallery, please review and accept the Terms and
          Conditions and Privacy Policy.
        </p>
      </div>

      <div className="mt-7 space-y-4">
        <label className="flex cursor-pointer gap-3 rounded-lg border border-white/0 py-1 text-sm leading-6 text-white/88">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-white/[0.06] accent-cyan-300"
          />

          <span>
            <span className="font-bold">I agree to the </span>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                setShowTerms(true)
              }}
              className="font-black text-cyan-300 underline decoration-cyan-300/50 underline-offset-2"
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
              className="font-black text-cyan-300 underline decoration-cyan-300/50 underline-offset-2"
            >
              Privacy Policy.
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer gap-3 rounded-lg border border-white/0 py-1 text-sm leading-6 text-white/45">
          <input
            type="checkbox"
            checked={marketingAccepted}
            onChange={(event) => setMarketingAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-white/[0.06] accent-cyan-300"
          />

          <span>
            Send me occasional product updates, painting inspiration and
            community news.
          </span>
        </label>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
          {error}
        </p>
      ) : null}

      <div className="mt-auto space-y-4 pt-10">
        <button
          type="button"
          disabled={!accepted || isSaving}
          onClick={continueAfterTerms}
          className="tap-press tap-target h-14 w-full rounded-2xl bg-cyan-400 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/28 disabled:shadow-none"
        >
          {isSaving ? 'Saving...' : 'Accept and continue'}
        </button>

        <button
          type="button"
          onClick={signOut}
          className="tap-target mx-auto block rounded-full px-4 py-2 text-sm font-bold text-white/35 transition hover:bg-white/5 hover:text-white/65"
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
    <div className="flex gap-2" aria-label="Onboarding step 1 of 3">
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
