'use client'

import type { EmailOtpType } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { isV3PreviewValue } from '../../../lib/v3-preview'
import styles from '../../auth-flow-silver.module.css'

const emailOtpTypes = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function safeNextPath(value: string | null) {
  if (!value?.startsWith('/')) {
    return '/dashboard'
  }

  return value
}

function getSafeReason(value: string | null) {
  if (!value) {
    return null
  }

  return value.replace(/\s+/g, ' ').slice(0, 180)
}

function getLoginErrorUrl(reason: string | null, next: string) {
  const loginUrl = new URL('/login', window.location.origin)
  loginUrl.searchParams.set('error', 'auth-callback')

  if (next !== '/dashboard') {
    loginUrl.searchParams.set('next', next)
  }

  try {
    const nextUrl = new URL(next, window.location.origin)

    if (isV3PreviewValue(nextUrl.searchParams.get('preview'))) {
      loginUrl.searchParams.set('preview', '1')
    }
  } catch {
    // Keep the generic login fallback if the next value cannot be parsed.
  }

  if (reason) {
    loginUrl.searchParams.set('reason', reason)
  }

  return loginUrl.toString()
}

function getOtpType(value: string | null): EmailOtpType {
  if (value && emailOtpTypes.has(value as EmailOtpType)) {
    return value as EmailOtpType
  }

  return 'email'
}

export default function AuthConfirmClient() {
  const [status, setStatus] = useState('Signing you in...')
  const params = useMemo(() => {
    if (typeof window === 'undefined') {
      return new URLSearchParams()
    }

    return new URLSearchParams(window.location.search)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function finishAuth() {
      const next = safeNextPath(params.get('next'))
      const providerError =
        params.get('error_description') ??
        params.get('error_code') ??
        params.get('error')

      if (providerError) {
        window.location.replace(getLoginErrorUrl(getSafeReason(providerError), next))
        return
      }

      const code = params.get('code')
      const tokenHash =
        params.get('token_hash') ??
        params.get('token_hash_email') ??
        params.get('token')

      if (!code && !tokenHash) {
        window.location.replace(
          getLoginErrorUrl('No auth code or token was returned.', next)
        )
        return
      }

      const { createClient } = await import('../../../utils/supabase/client')
      const supabase = createClient()
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: getOtpType(params.get('type')),
          })

      if (cancelled) {
        return
      }

      if (result.error) {
        window.location.replace(
          getLoginErrorUrl(getSafeReason(result.error.message), next)
        )
        return
      }

      setStatus('Taking you in...')
      window.location.replace(next)
    }

    finishAuth().catch((error: unknown) => {
      if (cancelled) {
        return
      }

      const message = error instanceof Error ? error.message : 'Auth failed.'
      window.location.replace(
        getLoginErrorUrl(getSafeReason(message), safeNextPath(params.get('next')))
      )
    })

    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <main className={`${styles.authRoot} px-6`}>
      <section className={styles.confirmPanel}>
        <div className={styles.confirmSpinnerShell}>
          <span className={styles.spin} />
        </div>
        <p className={`${styles.eyebrow} mt-6`}>
          Obsidian Gallery
        </p>
        <h1 className={styles.confirmTitle}>{status}</h1>
        <p className={`${styles.screenCopy} mx-auto mt-3`}>
          Keep this tab open while we finish the secure sign-in handoff.
        </p>
      </section>
    </main>
  )
}
