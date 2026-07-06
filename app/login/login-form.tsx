'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
const GoogleLoginButton = dynamic(() => import('./google-login-button'))

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const { createClient } = await import('../../utils/supabase/client')
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', nextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage('Magic link sent. Check your email.')
    setLoading(false)
  }

  return (
    <>
      <form onSubmit={handleLogin} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm text-neutral-300">Email</label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            placeholder="you@example.com"
          />
        </div>

        <GoogleLoginButton nextPath={nextPath} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
            Or continue with email
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="tap-press tap-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : null}
          <span>{loading ? 'Sending...' : 'Send Magic Link'}</span>
        </button>
      </form>

      {message ? <p className="mt-4 text-sm text-neutral-300">{message}</p> : null}
    </>
  )
}
