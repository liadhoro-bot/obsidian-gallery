import LoginExperience from './login-experience'
import { isV3PreviewValue } from '../../lib/v3-preview'

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
  const previewMode = isV3PreviewValue(resolvedSearchParams?.preview)
  const callbackReason = resolvedSearchParams?.reason?.trim()
  const authError =
    !previewMode && resolvedSearchParams?.error === 'auth-callback'
      ? callbackReason
        ? `Sign-in failed: ${callbackReason}`
        : 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null
  const requestedNext =
    resolvedSearchParams?.next ??
    (previewMode ? '/dashboard?preview=1' : '/dashboard')
  const nextPath = requestedNext.startsWith('/') ? requestedNext : '/dashboard'

  return (
    <LoginExperience
      nextPath={nextPath}
      authError={authError}
      previewMode={previewMode}
    />
  )
}
