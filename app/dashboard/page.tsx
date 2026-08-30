import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import { isLocalV3PreviewHost } from '../../lib/v3-preview'
import {
  getDashboardOnboardingRequirement,
  getOnboardingRedirectPath,
} from '../../lib/onboarding/dashboard-entry-guard'

import DashboardTabSwitcher from './dashboard-tab-switcher'
import DashboardTopBar from './dashboard-top-bar'
import DashboardWelcome from './dashboard-welcome'
import DashboardXpCard from './dashboard-xp-card'
import DashboardMetadataGrid from './dashboard-metadata-grid'
import DashboardPaintingTable from './dashboard-painting-table'
import DashboardQuickActions from './dashboard-quick-actions'
import DashboardHobbyBadges from './dashboard-hobby-badges'
import DashboardAchievements from './dashboard-achievements'
import type { DashboardFeatureGuide } from './feature-guide-types'

import {
  BenchUnitsSkeleton,
  FeaturedUnitSkeleton,
  StatsSkeleton,
  TopBarSkeleton,
} from './dashboard-skeletons'

type DashboardPageProps = {
  searchParams?: Promise<{
    golden?: string
    preview?: string
    tab?: string
  }>
}

const dashboardFeatureGuideOrder = [
  'dashboard.page',
  'dashboard.tabs.active_units',
  'dashboard.tabs.my_progress',
  'dashboard.next_actions.panel',
  'dashboard.featured_unit',
  'dashboard.up_next.panel',
] as const

const dashboardFeatureGuideFallbacks: Record<
  (typeof dashboardFeatureGuideOrder)[number],
  DashboardFeatureGuide
> = {
  'dashboard.page': {
    uid: 'dashboard.page',
    feature_name: 'Dashboard',
    location_reference: 'Dashboard header > title',
    component_reference: 'app/dashboard/dashboard-v3-preview.tsx',
    explanation:
      'The Dashboard is the home workbench: it gives you the quickest route back into active units, shows the next concrete actions to take, and keeps your painting progress visible.',
    place_in_page: 'Dashboard header',
    coach_mark_area: 'The Dashboard page title',
    popup_placement: 'bottom-end',
    display_order: 100,
  },
  'dashboard.tabs.active_units': {
    uid: 'dashboard.tabs.active_units',
    feature_name: 'Active Units',
    location_reference: 'Dashboard > tabs > Active Units',
    component_reference: 'app/dashboard/dashboard-v3-preview.tsx',
    explanation:
      'Active Units is the working tab. It contains your Next Actions, the Featured Unit you are focused on, and the Up Next card for switching between unit statuses and layouts.',
    place_in_page: 'Dashboard tab row',
    coach_mark_area: 'The Active Units tab',
    popup_placement: 'bottom',
    display_order: 110,
  },
  'dashboard.tabs.my_progress': {
    uid: 'dashboard.tabs.my_progress',
    feature_name: 'My Progress',
    location_reference: 'Dashboard > tabs > My Progress',
    component_reference: 'app/dashboard/dashboard-v3-preview.tsx',
    explanation:
      'My Progress is your hobby record. It gathers your Path to Grandmastery XP bar, paint streak, earned badges, and personal stats into one progress view.',
    place_in_page: 'Dashboard tab row',
    coach_mark_area: 'The My Progress tab',
    popup_placement: 'bottom',
    display_order: 120,
  },
  'dashboard.next_actions.panel': {
    uid: 'dashboard.next_actions.panel',
    feature_name: 'Next Actions',
    location_reference: 'Dashboard > Next Actions',
    component_reference: 'app/dashboard/dashboard-next-actions-card.tsx',
    explanation:
      'Next Actions turns the dashboard into a checklist. Each action shows where it belongs in the app, the check control marks it done, and the Go button takes you directly to the place where that action happens.',
    place_in_page: 'Top of the Active Units tab',
    coach_mark_area: 'The whole next actions card',
    popup_placement: 'bottom',
    display_order: 130,
  },
  'dashboard.featured_unit': {
    uid: 'dashboard.featured_unit',
    feature_name: 'Featured Unit',
    location_reference: 'Dashboard > Featured Unit',
    component_reference: 'app/dashboard/dashboard-unit-in-progress.tsx',
    explanation:
      'Featured Unit is the main miniature you are working on now. It shows its image, stage, status, and progress. The Resume button opens that unit and starts the painting clock so you can continue immediately.',
    place_in_page: 'Middle of the Active Units tab',
    coach_mark_area: 'The large featured unit card',
    popup_placement: 'top',
    display_order: 140,
  },
  'dashboard.up_next.panel': {
    uid: 'dashboard.up_next.panel',
    feature_name: 'Up Next',
    location_reference: 'Dashboard > Up Next',
    component_reference: 'app/dashboard/dashboard-active-units-view.tsx',
    explanation:
      'Up Next is your active unit shelf. Use the status menu to switch between unit states, and press any unit card to open that unit page.',
    place_in_page: 'Bottom of the Active Units tab',
    coach_mark_area: 'The whole Up Next card',
    popup_placement: 'top',
    display_order: 150,
  },
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const perf = createPerfTimer('/dashboard')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(resolvedSearchParams?.preview)
  const headerStore = await headers()
  const isLocalPreviewHost = isLocalV3PreviewHost(headerStore.get('host'))
  const isGoldenFixture =
    isPreview &&
    isLocalPreviewHost &&
    resolvedSearchParams?.golden === 'dashboard-active-units'

  if (isGoldenFixture) {
    const [
      { WorkbenchShell },
      { DashboardActiveUnitsGoldenFixtureScreen },
      { default: styles },
    ] = await Promise.all([
      import('@/src/components/v3'),
      import('./dashboard-active-units-screen'),
      import('./dashboard-og.module.css'),
    ])

    perf.total()
    return (
      <WorkbenchShell
        contentClassName={styles.dashboardFrame}
        gutter="none"
        maxWidth="var(--og-workbench-compact-max-width)"
      >
        <DashboardActiveUnitsGoldenFixtureScreen />
      </WorkbenchShell>
    )
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      isPreview
        ? '/login?next=%2Fdashboard%3Fpreview%3D1&preview=1'
        : '/login'
    )
  }

  const onboarding = await getDashboardOnboardingRequirement(user.id)

  if (onboarding.needsOnboarding && onboarding.reason) {
    redirect(
      getOnboardingRedirectPath({
        preview: isPreview,
        reason: onboarding.reason,
      })
    )
  }

  if (isPreview) {
    const [
      { WorkbenchShell },
      { DashboardActiveUnitsScreen },
      { default: styles },
      featureGuides,
    ] = await perf.measure('v3 dashboard shell', () =>
      Promise.all([
        import('@/src/components/v3'),
        import('./dashboard-active-units-screen'),
        import('./dashboard-og.module.css'),
        getDashboardFeatureGuides(),
      ])
    )

    const activeTab =
      resolvedSearchParams?.tab === 'profile' ? 'profile' : 'painting-table'
    const previewProfilePanel = (
      <div className={styles.profileStack}>
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardAchievements userId={user.id} />
        </Suspense>
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardMetadataGrid userId={user.id} />
        </Suspense>
      </div>
    )

    perf.total()
    return (
      <WorkbenchShell
        contentClassName={styles.dashboardFrame}
        gutter="none"
        maxWidth="var(--og-workbench-compact-max-width)"
      >
        <DashboardActiveUnitsScreen
          featureGuides={featureGuides}
          initialTab={activeTab}
          profilePanel={previewProfilePanel}
          userId={user.id}
        />
      </WorkbenchShell>
    )
  }

  const activeTab =
    resolvedSearchParams?.tab === 'profile' ? 'profile' : 'painting-table'
  perf.total()

  const xpCardShell = (
    <section className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-5">
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
      <Suspense fallback={profileShell}>{profileContent}</Suspense>
    )

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
          paintingTablePanel={paintingTableContent}
        />
      </div>
    </main>
  )
}

async function getDashboardFeatureGuides(): Promise<DashboardFeatureGuide[]> {
  const fallbackGuides = dashboardFeatureGuideOrder.map(
    (uid) => dashboardFeatureGuideFallbacks[uid]
  )

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('feature_guide')
      .select(
        'uid, feature_name, location_reference, component_reference, explanation, place_in_page, coach_mark_area, popup_placement, display_order'
      )
      .in('uid', [...dashboardFeatureGuideOrder])

    if (error || !data) {
      return fallbackGuides
    }

    const guideMap = new Map(
      data.map((guide) => [guide.uid, guide as DashboardFeatureGuide])
    )

    return dashboardFeatureGuideOrder.map((uid) => ({
      ...dashboardFeatureGuideFallbacks[uid],
      ...guideMap.get(uid),
    }))
  } catch {
    return fallbackGuides
  }
}
