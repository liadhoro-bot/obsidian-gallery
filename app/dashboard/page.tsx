import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

import MobileNav from '../components/MobileNav'
import DashboardTabs from './dashboard-tabs'
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

  const profilePromise = Promise.resolve(
  supabase
    .from('profiles')
    .select('avatar_url, level')
    .eq('id', user.id)
    .single()
)

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={<TopBarSkeleton />}>
          <DashboardTopBar profilePromise={profilePromise} />
        </Suspense>

        <DashboardWelcome />

        <DashboardTabs
          profileContent={
            <div className="grid gap-5">
              <DashboardXpCard />
              <DashboardHobbyBadges />

              <Suspense fallback={<StatsSkeleton />}>
                <DashboardMetadataGrid userId={user.id} />
              </Suspense>
            </div>
          }
          paintingTableContent={
            <div className="grid gap-5">
              <DashboardQuickActions />

              <Suspense fallback={<FeaturedUnitSkeleton />}>
                <DashboardUnitInProgress userId={user.id} />
              </Suspense>

              <Suspense fallback={<BenchUnitsSkeleton />}>
                <DashboardActiveBench userId={user.id} />
              </Suspense>
            </div>
          }
        />
      </div>

      <MobileNav />
    </main>
  )
}