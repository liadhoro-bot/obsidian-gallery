import LoginForm from './login-form'

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
    next?: string
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
  const requestedNext = resolvedSearchParams?.next ?? '/dashboard'
  const nextPath = requestedNext.startsWith('/') ? requestedNext : '/dashboard'
  const callbackReason = getFriendlyAuthErrorReason(resolvedSearchParams?.reason)
  const authError =
    resolvedSearchParams?.error === 'auth-callback'
      ? callbackReason
        ? `Sign-in failed: ${callbackReason}`
        : 'That magic link expired or was opened somewhere else. Send yourself a new one to get back in.'
      : null

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
