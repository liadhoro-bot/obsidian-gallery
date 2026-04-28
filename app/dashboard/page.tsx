import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import DashboardTopBar from './dashboard-top-bar'
import DashboardWelcome from './dashboard-welcome'
import DashboardXpCard from './dashboard-xp-card'
import DashboardMetadataGrid from './dashboard-metadata-grid'
import DashboardUnitInProgress from './dashboard-unit-in-progress'
import DashboardActiveBench from './dashboard-active-bench'
import DashboardQuickActions from './dashboard-quick-actions'
import DashboardHobbyBadges from './dashboard-hobby-badges'
import {
  BenchUnitsSkeleton,
  FeaturedUnitSkeleton,
  HeroCardSkeleton,
  StatsSkeleton,
  TopBarSkeleton,
} from './dashboard-skeletons'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={<TopBarSkeleton />}>
          <DashboardTopBar />
        </Suspense>

        <DashboardWelcome />

        <Suspense fallback={<HeroCardSkeleton />}>
          <DashboardXpCard />
        </Suspense>

        <Suspense fallback={<StatsSkeleton />}>
          <DashboardMetadataGrid />
        </Suspense>

        <Suspense fallback={<FeaturedUnitSkeleton />}>
          <DashboardUnitInProgress />
        </Suspense>

        <DashboardQuickActions />

        <DashboardHobbyBadges />

        <Suspense fallback={<BenchUnitsSkeleton />}>
          <DashboardActiveBench />
        </Suspense>
      </div>

      <MobileNav />
    </main>
  )
}