import DashboardWelcome from './dashboard-welcome'
import DashboardQuickActions from './dashboard-quick-actions'
import {
  BenchUnitsSkeleton,
  FeaturedUnitSkeleton,
  TopBarSkeleton,
} from './dashboard-skeletons'

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <TopBarSkeleton />
        <DashboardWelcome />
        <DashboardQuickActions />
        <FeaturedUnitSkeleton />
        <BenchUnitsSkeleton />
      </div>
    </main>
  )
}
