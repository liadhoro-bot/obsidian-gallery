'use client'

import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import GoogleLoginButton from './google-login-button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Obsidian Gallery
        </p>

        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>

        <p className="mt-3 text-sm text-neutral-400">
          Enter your email and we’ll send you a magic link.
        </p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-neutral-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              placeholder="you@example.com"
            />
          </div>
<GoogleLoginButton />

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
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            <span>{loading ? 'Sending...' : 'Send Magic Link'}</span>
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-neutral-300">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}
