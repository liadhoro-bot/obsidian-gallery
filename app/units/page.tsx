import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import { getDashboardPaintingTableFeed, getDashboardProfile } from '../dashboard/dashboard-data'
import { createPerfTimer } from '../../utils/perf/server'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import UnitsLibrary from './unit-library'

async function UnitsLibraryContent({ userId }: { userId: string }) {
  const { units, heroUnit } = await getDashboardPaintingTableFeed(userId)
  return <UnitsLibrary units={units} heroUnit={heroUnit} />
}

function UnitsLibrarySkeleton() {
  return (
    <section className="grid gap-4 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm animate-pulse">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="h-6 w-32 rounded bg-neutral-800" />
        <div className="h-10 w-24 rounded-xl bg-neutral-800" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <div className="min-h-[240px] bg-neutral-800" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="min-h-[110px] rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </section>
  )
}

export default async function UnitsPage() {
  const perf = createPerfTimer('/units')
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const profilePromise = (async () => ({
    data: await getDashboardProfile(user.id),
  }))()
  perf.total()

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Units</h1>
              <p className="mt-2 text-sm font-medium text-neutral-200">
                Track what is on your bench right now.
              </p>
            </div>

            <Link
              href="/units/new"
              className="inline-flex shrink-0 rounded-2xl border border-cyan-300/55 bg-black/45 px-4 py-2.5 text-xs font-black uppercase text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950"
            >
              New Unit
            </Link>
          </div>

          <p className="text-sm leading-6 text-neutral-400">
            Keep your active, bench, and completed units close at hand with fast
            resume paths and a dedicated library view.
          </p>
        </header>

        <Suspense fallback={<UnitsLibrarySkeleton />}>
          <UnitsLibraryContent userId={user.id} />
        </Suspense>
      </div>
    </main>
  )
}
