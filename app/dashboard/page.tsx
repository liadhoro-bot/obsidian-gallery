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

import {
  BenchUnitsSkeleton,
  FeaturedUnitSkeleton,
  StatsSkeleton,
  TopBarSkeleton,
} from './dashboard-skeletons'

type DashboardPageProps = {
  searchParams?: Promise<{
    tab?: string
  }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const perf = createPerfTimer('/dashboard')
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
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
          profilePanel={profilePanel}
          paintingTablePanel={paintingTablePanel}
        />
      </div>
    </main>
  )
}

