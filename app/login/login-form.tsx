'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import styles from '../auth-flow-silver.module.css'
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
  useLocalPreviewAuth = false,
  onAudienceChange,
  onBack,
}: {
  audience: LoginAudience
  authError?: string | null
  nextPath: string
  previewMode?: boolean
  useLocalPreviewAuth?: boolean
  onAudienceChange: (audience: LoginAudience) => void
  onBack: () => void
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<LoginMessage | null>(
    authError ? { kind: 'error', text: authError } : null
  )
  const [loading, setLoading] = useState(false)
  // `nextPath` was already resolved server-side (page.tsx), including the
  // carve-out that keeps a plain /dashboard target out of preview mode -
  // re-deriving preview-forcing from `previewMode` here would silently
  // re-apply ?preview=1 and undo that carve-out. Only /onboarding (the
  // 'new' audience target) needs preview-forcing computed client-side,
  // since the server can't know in advance which audience the visitor picks.
  const effectiveNextPath =
    audience === 'new' ? getEffectiveNextPath('/onboarding', previewMode) : nextPath

  useEffect(() => {
    performance.mark('v3-login-form-hydrated')
  }, [])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    performance.mark('v3-login-submit')

    setLoading(true)
    setMessage(null)

    if (useLocalPreviewAuth) {
      const response = await fetch('/auth/dev-preview-session?preview=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          next: effectiveNextPath,
        }),
      })
      const result = (await response.json().catch(() => null)) as {
        error?: string
        redirectTo?: string
      } | null

      if (!response.ok || !result?.redirectTo) {
        setMessage({
          kind: 'error',
          text:
            result?.error ??
            'Local preview sign-in did not complete. Check the email and try again.',
        })
        setLoading(false)
        return
      }

      window.location.assign(result.redirectTo)
      return
    }

    const { createClient } = await import('../../utils/supabase/client')
    const supabase = createClient()
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', effectiveNextPath)
    if (previewMode) {
      callbackUrl.searchParams.set('preview', '1')
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setMessage({
        kind: 'error',
        text: error.message,
      })
      setLoading(false)
      return
    }

    setMessage({ kind: 'success', text: 'Magic link sent. Check your email.' })
    setLoading(false)
  }

  return (
    <section
      className={styles.formPanel}
      data-v3-login-indicator="form"
      data-v3-login-mode={
        useLocalPreviewAuth
          ? 'local-preview-auth'
          : previewMode
            ? 'v3-supabase-auth'
            : 'production-auth'
      }
    >
      <div className="px-1 pb-2">
        <p className={styles.eyebrow}>
          Obsidian Gallery
        </p>
        <h1 className={styles.formHeading}>
          Your miniature workspace. Organized to perfection.
        </h1>
      </div>

      <div className={styles.segmentControl}>
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
                styles.segmentButton,
                isActive
                  ? styles.segmentActive
                  : styles.segmentInactive,
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <form onSubmit={handleLogin} className={styles.formStack}>
        {useLocalPreviewAuth ? (
          <p className={styles.notice}>
            Local preview sign-in uses your account email in this browser.
          </p>
        ) : (
          <>
            <GoogleLoginButton nextPath={effectiveNextPath} />

            <div className={styles.divider}>
              <span>Or continue with email</span>
            </div>
          </>
        )}

        <label className="block">
          <span className="sr-only">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className={styles.input}
            placeholder="you@example.com"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className={`tap-press tap-target ${styles.ctaButton}`}
        >
          {loading ? (
            <span className={styles.spin} />
          ) : null}
          <span>
            {loading
              ? useLocalPreviewAuth
                ? 'Signing in...'
                : 'Sending...'
              : useLocalPreviewAuth
                ? 'Sign in to Preview'
                : 'Send Magic Link'}
          </span>
        </button>
      </form>

      <p className={styles.helperText}>
        {audience === 'new'
            ? "First time? You'll be guided through setup after signing in."
            : 'Welcome back. We will take you where you were headed.'}
      </p>

      {message ? (
        <p
          className={`${styles.message} ${
            message.kind === 'error'
              ? styles.messageError
              : styles.messageSuccess
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className={`tap-target ${styles.backButton}`}
      >
        &larr; Back
      </button>
    </section>
  )
}

function getEffectiveNextPath(nextPath: string, previewMode: boolean) {
  if (!previewMode) {
    return nextPath
  }

  const [pathAndQuery, hash = ''] = nextPath.split('#')
  const [pathname, query = ''] = pathAndQuery.split('?')
  const params = new URLSearchParams(query)
  params.set('preview', '1')
  const search = params.toString()

  return `${pathname}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`
}
