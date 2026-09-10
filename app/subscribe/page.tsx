import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { getSubscriptionStatus } from '../../lib/subscription/subscription-guard'
import SubscribeClient from './subscribe-client'

type SubscribePageProps = {
  searchParams?: Promise<{ next?: string }>
}

function safeNextPath(value: string | undefined) {
  if (!value?.startsWith('/')) {
    return '/dashboard'
  }

  return value
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = safeNextPath(resolvedSearchParams?.next)

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const status = await getSubscriptionStatus(user.email)

  if (status.isActive) {
    redirect(nextPath)
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
          Obsidian Gallery
        </p>

        <h1 className="mt-2 text-3xl font-bold">Get your pass</h1>

        <p className="mt-3 text-sm text-neutral-400">
          Signed in as{' '}
          <span className="font-semibold text-white">{user.email}</span>.
          Complete payment to unlock the app.
        </p>

        <SubscribeClient email={user.email ?? ''} nextPath={nextPath} />
      </div>
    </main>
  )
}
