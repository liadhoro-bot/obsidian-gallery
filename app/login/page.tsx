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
  const requestedNext = resolvedSearchParams?.next ?? '/dashboard'
  const nextPath = requestedNext.startsWith('/') ? requestedNext : '/dashboard'
  const previewMode = ['1', 'true'].includes(
    resolvedSearchParams?.preview ?? ''
  )

  return (
    <LoginExperience
      nextPath={nextPath}
      authError={authError}
      previewMode={previewMode}
    />
  )
}
