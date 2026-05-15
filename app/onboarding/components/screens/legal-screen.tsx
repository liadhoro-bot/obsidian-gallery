'use client'

import { useState } from 'react'

type Props = {
  onEnter: () => void
}

export default function LegalScreen({ onEnter }: Props) {
  const [accepted, setAccepted] = useState(false)

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

          <p className="max-w-sm text-base leading-7 text-white/60">
            Please review and accept the rules that keep Obsidian Gallery useful,
            respectful, and hobby-focused.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="max-h-52 overflow-y-auto rounded-3xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/60">
          <p className="font-bold text-white/80">Summary</p>

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
            Your project, paint, recipe, image, and profile data may be stored so
            the app can provide its core features. Public content may be visible
            to other users when you choose to publish it.
          </p>

          <div className="mt-4 flex flex-col gap-2 text-cyan-300">
            <a href="/terms" target="_blank" className="font-black underline">
              Read full Terms & Conditions
            </a>

            <a href="/privacy" target="_blank" className="font-black underline">
              Read Privacy Policy
            </a>
          </div>
        </div>

        <label className="flex cursor-pointer gap-3 rounded-3xl border border-white/10 bg-black/30 p-4">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-5 w-5 accent-cyan-400"
          />

          <span className="text-sm font-bold leading-6 text-white/70">
            I agree to the Terms & Conditions and Community Guidelines.
          </span>
        </label>

        <button
          type="button"
          disabled={!accepted}
          onClick={onEnter}
          className="h-12 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/15 text-sm font-black text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/25 disabled:shadow-none"
        >
          Enter Obsidian Gallery
        </button>
      </div>
    </section>
  )
}