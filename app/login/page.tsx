import LoginExperience from './login-experience'

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    next?: string
    preview?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const authError =
    resolvedSearchParams?.error === 'auth-callback'
      ? 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null
  const previewMode = ['1', 'true'].includes(
    resolvedSearchParams?.preview ?? ''
  )
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
