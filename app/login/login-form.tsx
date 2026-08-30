'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { signOutFromLogin } from './actions'
import styles from '../auth-flow-silver.module.css'

const GoogleLoginButton = dynamic(() => import('./google-login-button'))

export default function LoginForm({
  audience = 'returning',
  authError,
  currentUserEmail,
  nextPath,
  previewMode = false,
  surface = 'plain',
  useLocalPreviewAuth = false,
  onAudienceChange,
  onBack,
}: {
  audience?: 'new' | 'returning'
  authError?: string | null
  currentUserEmail?: string | null
  nextPath: string
  previewMode?: boolean
  surface?: 'plain' | 'v3'
  useLocalPreviewAuth?: boolean
  onAudienceChange?: (audience: 'new' | 'returning') => void
  onBack?: () => void
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(authError ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (previewMode) {
      performance.mark('v3-login-form-hydrated')
    }
  }, [previewMode])

  const isV3Surface = surface === 'v3'
  const showAudienceControls = Boolean(onAudienceChange)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const requestedEmail = email.trim()
    const normalizedRequestedEmail = requestedEmail.toLowerCase()
    const normalizedCurrentEmail = currentUserEmail?.trim().toLowerCase()

    if (
      currentUserEmail &&
      normalizedCurrentEmail &&
      normalizedRequestedEmail !== normalizedCurrentEmail
    ) {
      setMessage(
        `You're already signed in as ${currentUserEmail}. Sign out before opening ${requestedEmail}.`
      )
      setLoading(false)
      return
    }

    if (currentUserEmail && normalizedRequestedEmail === normalizedCurrentEmail) {
      window.location.assign(nextPath)
      return
    }

    if (useLocalPreviewAuth) {
      const response = await fetch('/auth/dev-preview-session?preview=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: requestedEmail, next: nextPath }),
      })
      const payload = (await response.json().catch(() => null)) as {
        error?: string
        redirectTo?: string
      } | null

      if (!response.ok || !payload?.redirectTo) {
        setMessage(payload?.error || 'Could not open the local preview session.')
        setLoading(false)
        return
      }

      window.location.assign(payload.redirectTo)
      return
    }

    const { createClient } = await import('../../utils/supabase/client')
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', nextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email: requestedEmail,
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
    <section
      className={isV3Surface ? styles.formPanel : undefined}
      data-v3-login-indicator={previewMode ? 'form' : undefined}
      data-v3-login-mode={
        previewMode
          ? useLocalPreviewAuth
            ? 'preview-auth'
            : 'live-auth'
          : undefined
      }
    >
      {isV3Surface ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              {audience === 'new' ? 'New painter' : 'Returning'}
            </p>
            <h2 className={styles.formHeading}>
              {useLocalPreviewAuth ? 'Open local preview' : 'Sign in'}
            </h2>
          </div>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-full px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-950/5"
            >
              Back
            </button>
          ) : null}
        </div>
      ) : null}

      {showAudienceControls ? (
        <div className={styles.segmentControl}>
          <button
            type="button"
            onClick={() => onAudienceChange?.('new')}
            className={[
              styles.segmentButton,
              audience === 'new'
                ? styles.segmentActive
                : styles.segmentInactive,
            ].join(' ')}
          >
            New painter
          </button>
          <button
            type="button"
            onClick={() => onAudienceChange?.('returning')}
            className={[
              styles.segmentButton,
              audience === 'returning'
                ? styles.segmentActive
                : styles.segmentInactive,
            ].join(' ')}
          >
            Returning
          </button>
        </div>
      ) : null}

      {currentUserEmail ? (
        <div
          className={
            isV3Surface
              ? `${styles.notice} mt-4`
              : 'mb-4 rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-3 text-sm text-neutral-200'
          }
        >
          <p>
            Currently signed in as{' '}
            <span className={isV3Surface ? 'font-semibold' : 'font-semibold text-white'}>
              {currentUserEmail}
            </span>
            .
          </p>
          <form action={signOutFromLogin} className="mt-3">
            <input type="hidden" name="next" value={nextPath} />
            {previewMode ? (
              <input type="hidden" name="preview" value="1" />
            ) : null}
            <button
              type="submit"
              className={
                isV3Surface
                  ? `tap-target ${styles.backButton}`
                  : 'tap-target rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10'
              }
            >
              Sign out to switch account
            </button>
          </form>
        </div>
      ) : null}

      <form
        onSubmit={handleLogin}
        className={isV3Surface ? styles.formStack : 'mt-6 space-y-4'}
      >
        <div>
          <label
            className={
              isV3Surface
                ? 'mb-2 block text-sm font-bold text-neutral-700'
                : 'mb-2 block text-sm text-neutral-300'
            }
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className={
              isV3Surface
                ? styles.input
                : 'min-h-11 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white'
            }
            placeholder="you@example.com"
          />
        </div>

        {useLocalPreviewAuth || currentUserEmail ? null : (
          <GoogleLoginButton nextPath={nextPath} />
        )}

        {useLocalPreviewAuth || currentUserEmail ? null : (
          <div className={isV3Surface ? styles.divider : 'flex items-center gap-3'}>
            {isV3Surface ? null : <div className="h-px flex-1 bg-white/10" />}
            <span
              className={
                isV3Surface
                  ? undefined
                  : 'text-[10px] font-bold uppercase tracking-[0.28em] text-white/40'
              }
            >
              Or continue with email
            </span>
            {isV3Surface ? null : <div className="h-px flex-1 bg-white/10" />}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={
            isV3Surface
              ? `tap-press tap-target ${styles.ctaButton}`
              : 'tap-press tap-target inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70'
          }
        >
          {loading ? (
            <span
              className={
                isV3Surface
                  ? styles.spin
                  : 'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'
              }
            />
          ) : null}
          <span>
            {loading
              ? useLocalPreviewAuth
                ? 'Opening...'
                : 'Sending...'
              : currentUserEmail
                ? 'Continue as current account'
              : useLocalPreviewAuth
                ? 'Open V3 Preview'
                : 'Send Magic Link'}
          </span>
        </button>
      </form>

      {message ? (
        <p className={isV3Surface ? styles.message : 'mt-4 text-sm text-neutral-300'}>
          {message}
        </p>
      ) : null}
    </section>
  )
}
