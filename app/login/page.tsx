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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const headerStore = await headers()
  const host = headerStore.get('host')
  const previewMode =
    isV3PreviewValue(resolvedSearchParams?.preview) ||
    isV3DeploymentHost(host)
  const useLocalPreviewAuth =
    isV3PreviewValue(resolvedSearchParams?.preview) &&
    isLocalV3PreviewHost(host)
  const callbackReason = resolvedSearchParams?.reason?.trim()
  const authError =
    resolvedSearchParams?.error === 'auth-callback'
      ? callbackReason
        ? `Sign-in failed: ${callbackReason}`
        : 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null
  const requestedNext =
    resolvedSearchParams?.next ??
    (previewMode ? '/dashboard?preview=1' : '/dashboard')
  const nextPath = previewMode
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
