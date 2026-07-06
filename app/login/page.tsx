import LoginForm from './login-form'

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const requestedNext = resolvedSearchParams?.next ?? '/dashboard'
  const nextPath = requestedNext.startsWith('/') ? requestedNext : '/dashboard'

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

        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  )
}
