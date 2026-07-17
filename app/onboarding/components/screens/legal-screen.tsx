'use client'

import { useState } from 'react'
import TermsModal from './terms-modal'
import { acceptTermsAction } from '../../actions'

type Props = {
  onEnter: () => void
  previewMode?: boolean
}

export default function LegalScreen({ onEnter, previewMode = false }: Props) {
  const [accepted, setAccepted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="flex min-h-[520px] flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)]">
      <div className="space-y-4">
        <div className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
          Terms & Privacy
        </div>

        <div className="space-y-3 pt-4">
          <h2 className="text-3xl font-black leading-tight text-white">
            One last thing
            <br />
            before you enter.
          </h2>

          <p className="max-w-sm text-base leading-7 text-white/70">
            Please review and accept the rules that keep Obsidian Gallery useful,
            respectful, and hobby-focused.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="legal-scroll max-h-52 overflow-y-auto rounded-3xl border border-white/10 bg-black/30 p-4 pr-5 text-sm leading-6 text-white/85">
          <p className="font-bold text-white">Summary</p>

          <p className="mt-3">
            By using Obsidian Gallery, you agree to use the app responsibly,
            upload only content you have the right to use, and avoid abusive,
            illegal, hateful, explicit, or disruptive material.
          </p>

          <p className="mt-3">
            Obsidian Gallery is built to support a respectful, hobby-focused
            community. Political extremism, harassment, hateful content, and
            explicit material are prohibited.
          </p>

          <p className="mt-3">
            Your project, paint, guide, image, and profile data may be stored so
            the app can provide its core features. Public content may be visible
            to other users when you choose to publish it.
          </p>

          <div className="mt-4 flex flex-col gap-2 text-cyan-300">
          {error ? (
            <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">
             {error}
             </p>
             ) : null}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="w-fit font-black underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-200"
            >
              Read full Terms & Conditions
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 accent-cyan-400"
          />

          <span className="text-sm font-bold leading-6 text-white/75">
            I agree to the Terms & Conditions and Community Guidelines.
          </span>
        </label>

        <button
          type="button"
          disabled={!accepted || isSaving}
          onClick={async () => {
  if (!accepted || isSaving) return

  setIsSaving(true)
  setError(null)

  if (previewMode) {
    onEnter()
    return
  }

  const result = await acceptTermsAction()

  if (!result.ok) {
    setError(result.error ?? 'Could not save your acceptance. Please try again.')
    setIsSaving(false)
    return
  }

  onEnter()
}}
          className="h-12 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/15 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/25 disabled:shadow-none"
        >
          {isSaving ? 'Entering...' : 'Enter Obsidian Gallery'}
        </button>
      </div>

{showTerms ? (
  <TermsModal onClose={() => setShowTerms(false)} />
) : null}

      <style jsx>{`
        .legal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.9) transparent;
        }

        .legal-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .legal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .legal-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(103, 232, 249, 0.95),
            rgba(34, 211, 238, 0.8)
          );
          box-shadow: 0 0 10px rgba(34, 211, 238, 0.35);
        }

        .legal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(103, 232, 249, 1);
        }

        .terms-embed {
          border: 0;
          overflow: hidden;
        }
      `}</style>
    </section>
  )
}
