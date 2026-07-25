'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
const GoogleLoginButton = dynamic(() => import('./google-login-button'))

type LoginAudience = 'new' | 'returning'

type LoginMessage = {
  kind: 'error' | 'success'
  text: string
}

export default function LoginForm({
  audience,
  authError,
  nextPath,
  previewMode = false,
  onAudienceChange,
  onBack,
}: {
  audience: LoginAudience
  authError?: string | null
  nextPath: string
  previewMode?: boolean
  onAudienceChange: (audience: LoginAudience) => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<LoginMessage | null>(
    authError ? { kind: 'error', text: authError } : null
  )
  const [loading, setLoading] = useState(false)
  const effectiveNextPath = audience === 'new' ? '/onboarding' : nextPath

  function continuePreviewFlow() {
    const onboardingUrl = new URL('/onboarding', window.location.origin)
    onboardingUrl.searchParams.set('preview', '1')
    onboardingUrl.searchParams.set('reset', Date.now().toString())
    window.location.assign(onboardingUrl.toString())
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (previewMode) {
      continuePreviewFlow()
      return
    }

    setLoading(true)
    setMessage(null)

    const { createClient } = await import('../../utils/supabase/client')
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', effectiveNextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setMessage({
        kind: 'error',
        text: 'That magic link did not send. Check the address and try again.',
      })
      setLoading(false)
      return
    }

    setMessage({ kind: 'success', text: 'Magic link sent. Check your email.' })
    setLoading(false)
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#06090d]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div className="px-1 pb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
          Obsidian Gallery
        </p>
        <h1 className="mt-2 text-2xl font-black leading-tight text-white">
          Your miniature workspace. Organized to perfection.
        </h1>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white/[0.08] p-1">
        {[
          { key: 'new' as const, label: 'New painter' },
          { key: 'returning' as const, label: 'Returning' },
        ].map((option) => {
          const isActive = audience === option.key

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onAudienceChange(option.key)}
              className={[
                'h-10 rounded-xl text-xs font-black transition',
                isActive
                  ? 'bg-[#101722] text-white shadow-sm'
                  : 'text-white/38 hover:text-white/70',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleLogin} className="mt-4 space-y-4">
        {previewMode ? (
          <button
            type="button"
            onClick={continuePreviewFlow}
            className="
              tap-press tap-target group relative flex w-full items-center justify-center gap-3 overflow-hidden
              rounded-2xl border border-cyan-300/20
              bg-white/[0.08] px-5 py-4
              text-sm font-black text-white
              shadow-[0_18px_55px_rgba(0,0,0,0.35)]
              backdrop-blur-xl
              hover:border-cyan-300/45 hover:bg-cyan-300/[0.10]
            "
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-400/0 via-cyan-300/10 to-purple-400/0 opacity-0 transition group-hover:opacity-100" />

            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg shadow-black/20">
              <GoogleIcon />
            </span>

            <span className="relative">Continue with Google</span>
          </button>
        ) : (
          <GoogleLoginButton nextPath={effectiveNextPath} />
        )}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Or continue with email
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#101722] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/55 focus:bg-[#121c29]"
            placeholder="you@example.com"
          />
        </label>

        <button
          type={previewMode ? 'button' : 'submit'}
          onClick={previewMode ? continuePreviewFlow : undefined}
          disabled={loading}
          className="tap-press tap-target inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-black text-black shadow-[0_0_28px_rgba(34,211,238,0.26)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/35 disabled:shadow-none"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          <span>
            {loading
              ? 'Sending...'
              : previewMode
                ? 'Continue to setup'
                : 'Send Magic Link'}
          </span>
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] font-bold leading-5 text-white/38">
        {previewMode
          ? 'Preview mode: no login required.'
          : audience === 'new'
            ? "First time? You'll be guided through setup after signing in."
            : 'Welcome back. We will take you where you were headed.'}
      </p>

      {message ? (
        <p
          className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${
            message.kind === 'error'
              ? 'border-red-400/25 bg-red-500/10 text-red-100'
              : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100'
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="tap-target mx-auto mt-4 block rounded-full px-4 py-2 text-sm font-bold text-white/40 transition hover:bg-white/5 hover:text-white/70"
      >
        &larr; Back
      </button>
    </section>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.805 10.023h-9.58v3.955h5.518c-.238 1.27-.963 2.348-2.052 3.064v2.546h3.324c1.945-1.792 3.065-4.43 3.065-7.557 0-.716-.064-1.405-.275-2.008z"
      />
      <path
        fill="#34A853"
        d="M12.225 22c2.775 0 5.104-.918 6.805-2.482l-3.324-2.546c-.918.616-2.094.98-3.481.98-2.67 0-4.933-1.802-5.742-4.226H3.047v2.625C4.738 19.713 8.214 22 12.225 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.483 13.726a5.864 5.864 0 0 1 0-3.74V7.36H3.047a10.002 10.002 0 0 0 0 8.99l3.436-2.625z"
      />
      <path
        fill="#EA4335"
        d="M12.225 5.904c1.51 0 2.867.52 3.934 1.54l2.948-2.948C17.326 2.836 14.997 2 12.225 2 8.214 2 4.738 4.287 3.047 7.36l3.436 2.626c.809-2.424 3.072-4.082 5.742-4.082z"
      />
    </svg>
  )
}
