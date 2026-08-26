import { headers } from 'next/headers'
import {
  ensureV3PreviewPath,
  isLocalV3PreviewHost,
  isV3PreviewValue,
} from '../../lib/v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import LoginForm from './login-form'

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    next?: string
    preview?: string
    reason?: string
  }>
}

function getFriendlyAuthErrorReason(value: string | null | undefined) {
  const reason = value?.replace(/\s+/g, ' ').trim()

  if (!reason) {
    return null
  }

  if (/pkce code verifier not found/i.test(reason)) {
    return 'That Google sign-in was opened from a different browser or stale tab. Send yourself a new magic link to get back in.'
  }

  return reason
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const previewMode = await hasV3PreviewSession(resolvedSearchParams?.preview)
  const requestedNext = resolvedSearchParams?.next ?? '/dashboard'
  const nextPath = requestedNext.startsWith('/') ? requestedNext : '/dashboard'
  const callbackReason = getFriendlyAuthErrorReason(resolvedSearchParams?.reason)
  const authError =
    resolvedSearchParams?.error === 'auth-callback'
      ? callbackReason
        ? `Sign-in failed: ${callbackReason}`
        : 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null

  if (previewMode) {
    const { default: LoginExperience } = await import('./login-experience')
    const headerStore = await headers()
    const host = headerStore.get('host')
    const useLocalPreviewAuth =
      isV3PreviewValue(resolvedSearchParams?.preview) &&
      isLocalV3PreviewHost(host)

    return (
      <LoginExperience
        nextPath={ensureV3PreviewPath(nextPath)}
        authError={authError}
        previewMode
        useLocalPreviewAuth={useLocalPreviewAuth}
      />
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Obsidian Gallery
        </p>

        <h1 className="mt-2 text-3xl font-bold">Sign in</h1>

        <p className="mt-3 text-sm text-neutral-400">
          Enter your email and we&apos;ll send you a magic link.
        </p>

        <LoginForm authError={authError} nextPath={nextPath} />
      </div>
    </main>
  )
}
