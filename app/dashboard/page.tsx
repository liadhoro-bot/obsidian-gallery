import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'

import DashboardTabSwitcher from './dashboard-tab-switcher'
import DashboardTopBar from './dashboard-top-bar'
import DashboardWelcome from './dashboard-welcome'
import DashboardXpCard from './dashboard-xp-card'
import DashboardMetadataGrid from './dashboard-metadata-grid'
import DashboardPaintingTable from './dashboard-painting-table'
import DashboardQuickActions from './dashboard-quick-actions'
import DashboardHobbyBadges from './dashboard-hobby-badges'
import DashboardNextActions from './dashboard-next-actions'

import {
  BenchUnitsSkeleton,
  FeaturedUnitSkeleton,
  StatsSkeleton,
  TopBarSkeleton,
} from './dashboard-skeletons'

type DashboardPageProps = {
  searchParams?: Promise<{
    preview?: string
    tab?: string
  }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const perf = createPerfTimer('/dashboard')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const isPreview = ['1', 'true'].includes(resolvedSearchParams?.preview ?? '')

  if (isPreview) {
    perf.total()
    return <DashboardPreview />
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const activeTab =
    resolvedSearchParams?.tab === 'profile' ? 'profile' : 'painting-table'
  perf.total()

  const xpCardShell = (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-3 w-32 rounded bg-white/10" />
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="h-8 w-40 rounded bg-white/10" />
        <div className="h-4 w-28 rounded bg-white/10" />
      </div>
      <div className="mt-4 h-3 w-full rounded-full bg-white/10" />
    </section>
  )

  const profileContent = (
    <div className="grid gap-5">
      <Suspense fallback={xpCardShell}>
        <DashboardXpCard userId={user.id} />
      </Suspense>
      <DashboardHobbyBadges />

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardMetadataGrid userId={user.id} />
      </Suspense>
    </div>
  )

  const profileShell = (
    <div className="grid gap-5">
      {xpCardShell}
      <DashboardHobbyBadges />
      <StatsSkeleton />
    </div>
  )

  const paintingTableContent = (
    <Suspense
      fallback={
        <div className="grid gap-5">
          <DashboardQuickActions />
          <FeaturedUnitSkeleton />
          <BenchUnitsSkeleton />
        </div>
      }
    >
      <div className="grid gap-5">
        <DashboardQuickActions />
        <DashboardPaintingTable userId={user.id} />
      </div>
    </Suspense>
  )

  const profilePanel =
    activeTab === 'profile' ? (
      profileContent
    ) : (
      <Suspense fallback={profileShell}>
        {profileContent}
      </Suspense>
    )

  const paintingTablePanel = paintingTableContent

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={<TopBarSkeleton />}>
          <DashboardTopBar userId={user.id} />
        </Suspense>

        <DashboardWelcome />

        <DashboardTabSwitcher
          initialTab={activeTab}
          nextActionsPanel={
            <Suspense fallback={null}>
              <DashboardNextActions userId={user.id} />
            </Suspense>
          }
          profilePanel={profilePanel}
          paintingTablePanel={paintingTablePanel}
        />
      </div>
    </main>
  )
}

function DashboardPreview() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
              Obsidian Gallery
            </p>
            <h1 className="mt-1 text-xl font-black">Your dashboard</h1>
          </div>
          <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black text-black">
            Preview
          </span>
        </header>

        <section className="space-y-2">
          <h2 className="text-3xl font-black leading-tight">
            One place for the next model, guide, and paint decision.
          </h2>
          <p className="text-sm font-medium leading-6 text-white/55">
            This temporary branch shows the complete v3 onboarding path without
            creating an account or writing onboarding records.
          </p>
        </section>

        <section className="grid gap-3">
          {[
            ['Next action', 'Prime and block in the largest color area.'],
            ['Active miniature', 'Your first onboarding model appears here.'],
            ['Guide workspace', 'Drafts and published recipes sit beside projects.'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
                {label}
              </p>
              <p className="mt-2 text-base font-bold leading-6 text-white">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
          <p className="text-sm font-bold leading-6 text-cyan-50">
            Preview complete. Auth, terms persistence, and real unit/guide
            mutations are intentionally bypassed on this inspection path.
          </p>
        </section>
      </div>
    </main>
  )
}

