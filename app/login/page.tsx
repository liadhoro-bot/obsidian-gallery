import LoginExperience from './login-experience'
import { headers } from 'next/headers'
import {
  ensureV3PreviewPath,
  isLocalV3PreviewHost,
  isV3DeploymentHost,
  isV3PreviewValue,
} from '../../lib/v3-preview'

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
    return 'That Google sign-in was opened from a different browser or stale tab. For local preview, enter your account email below to sign in here.'
  }

  return reason
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const headerStore = await headers()
  const host = headerStore.get('host')
  const explicitPreviewRequest = isV3PreviewValue(resolvedSearchParams?.preview)
  const previewMode = explicitPreviewRequest || isV3DeploymentHost(host)
  const useLocalPreviewAuth =
    explicitPreviewRequest && isLocalV3PreviewHost(host)
  const callbackReason = getFriendlyAuthErrorReason(resolvedSearchParams?.reason)
  const authError =
    resolvedSearchParams?.error === 'auth-callback'
      ? callbackReason
        ? `Sign-in failed: ${callbackReason}`
        : 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null
  const requestedNext = resolvedSearchParams?.next ?? '/dashboard'
  // /dashboard has its own real (non-preview) implementation now, so being on
  // the staging host alone should no longer force it into preview mode -
  // only an explicit ?preview=1 should. Other routes still auto-preview by host.
  const requestedNextIsDashboard =
    requestedNext === '/dashboard' || requestedNext.startsWith('/dashboard?')
  const nextPath =
    previewMode && !(requestedNextIsDashboard && !explicitPreviewRequest)
      ? ensureV3PreviewPath(requestedNext)
      : requestedNext.startsWith('/')
        ? requestedNext
        : '/dashboard'

  return (
    <LoginExperience
      nextPath={nextPath}
      authError={authError}
      previewMode={previewMode}
      useLocalPreviewAuth={useLocalPreviewAuth}
    />
  )
}
