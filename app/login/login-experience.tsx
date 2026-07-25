'use client'

import Image from 'next/image'
import { useState } from 'react'
import LoginForm from './login-form'

type LoginAudience = 'new' | 'returning'

type LoginExperienceProps = {
  authError?: string | null
  nextPath: string
}

export default function LoginExperience({
  authError,
  nextPath,
}: LoginExperienceProps) {
  const [showSignIn, setShowSignIn] = useState(Boolean(authError))
  const [audience, setAudience] = useState<LoginAudience>('new')

  function openSignIn(nextAudience: LoginAudience) {
    window.location.assign('/onboarding?preview=1')
    setAudience(nextAudience)
    setShowSignIn(true)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#030607] text-white">
      <div className="relative min-h-[100svh] w-full max-w-md overflow-hidden bg-[#030607] shadow-2xl shadow-black/60 sm:my-6 sm:min-h-[844px] sm:rounded-[8px] sm:border sm:border-white/10">
        <Image
          src="/onboarding/welcome-hero.jpeg"
          alt="Miniature painting hobby workspace"
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-black/48" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/88" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(20,184,166,0.2),transparent_26%),radial-gradient(circle_at_86%_32%,rgba(34,211,238,0.16),transparent_22%)]" />

        <FloatingSwatches />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full flex-col justify-between px-4 pb-8 pt-3 sm:min-h-[844px]">
          <header className="flex items-center justify-between rounded-full border border-cyan-300/15 bg-black/20 px-4 py-3 shadow-[0_0_24px_rgba(20,184,166,0.14)] backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
              Obsidian Gallery
            </span>

            <button
              type="button"
              onClick={() => openSignIn('returning')}
              className="tap-target rounded-full px-3 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Sign in
            </button>
          </header>

          <section className="pb-6">
            <div className="space-y-4">
              <h1 className="max-w-sm text-[3.15rem] font-black leading-[0.86] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] sm:text-[3.5rem]">
                Your miniature workspace. Organized to perfection.
              </h1>

              <p className="max-w-sm text-sm font-medium leading-6 text-white/72 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
                Track progress, manage paint, build guides, and share your
                finished work, all in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openSignIn('new')}
              className="tap-press tap-target mt-8 h-14 w-full rounded-2xl bg-cyan-400 px-5 text-sm font-black text-black shadow-[0_0_34px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300"
            >
              Start Here -&gt;
            </button>
          </section>
        </div>

        {showSignIn ? (
          <div className="absolute inset-0 z-20 flex items-end bg-black/20 px-4 pb-4 backdrop-blur-[1px] sm:items-center sm:justify-center sm:pb-0">
            <LoginForm
              audience={audience}
              authError={authError}
              nextPath={nextPath}
              onAudienceChange={setAudience}
              onBack={() => setShowSignIn(false)}
            />
          </div>
        ) : null}
      </div>
    </main>
  )
}

function FloatingSwatches() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -left-6 top-24 h-16 w-16 rotate-12 rounded-xl border border-cyan-200/20 bg-cyan-300/12 blur-[0.2px]" />
      <div className="absolute -right-5 top-44 h-12 w-12 -rotate-12 rounded-lg border border-teal-200/20 bg-teal-300/14" />
      <div className="absolute left-6 top-[48%] h-10 w-10 rotate-45 rounded-md border border-cyan-200/20 bg-cyan-300/10" />
      <div className="absolute -right-8 bottom-36 h-24 w-24 rotate-12 rounded-2xl border border-teal-200/10 bg-teal-300/10 blur-[1px]" />
    </div>
  )
}
