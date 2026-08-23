import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { WorkbenchShell } from '@/src/components/v3'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { isV3PreviewValue } from '../../lib/v3-preview'
import DashboardV3Preview from './dashboard-v3-preview'
import DashboardXpCard from './dashboard-xp-card'
import DashboardMetadataGrid, {
  DashboardPaintStreak,
} from './dashboard-metadata-grid'
import DashboardHobbyBadges from './dashboard-hobby-badges'
import type { DashboardFeatureGuide } from './feature-guide-types'
import {
  DashboardActiveUnitsGoldenFixtureScreen,
  DashboardActiveUnitsScreen,
} from './dashboard-active-units-screen'
import styles from './dashboard-og.module.css'
import {
  getDashboardMetadataSummary,
  getDashboardNextActions,
  getDashboardPaintingTableFeed,
  getDashboardXpState,
} from './dashboard-data'
import { PaintStreakSkeleton, StatsSkeleton } from './dashboard-skeletons'

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
      'Up Next is your active unit shelf. Use the status menu to switch between unit states, toggle grid or card view, and press any unit card to open that unit page.',
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
  const isPreview = isV3PreviewValue(resolvedSearchParams?.preview)
  const isGoldenFixture =
    resolvedSearchParams?.golden === 'dashboard-active-units'

  if (isGoldenFixture) {
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

  if (isPreview) {
    const [featureGuides, feed, metadata, nextActions, xpState] = await perf.measure(
      'v3 dashboard data',
      () =>
        Promise.all([
          getDashboardFeatureGuides(),
          getDashboardPaintingTableFeed(user.id),
          getDashboardMetadataSummary(user.id),
          getDashboardNextActions(user.id),
          getDashboardXpState(user.id),
        ])
    )

    perf.total()
    return (
      <DashboardPreview
        featureGuides={featureGuides}
        feed={feed}
        metadata={metadata}
        nextActions={nextActions}
        xpState={xpState}
      />
    )
  }

  const activeTab =
    resolvedSearchParams?.tab === 'profile' ? 'profile' : 'painting-table'
  perf.total()

  const xpCardShell = (
    <section className={`${styles.progressLedger} ${styles.profileSkeleton}`}>
      <div className={styles.progressLedgerHeader}>
        <div className={styles.skeletonCopy}>
          <span />
          <strong />
        </div>
        <span className={styles.levelMedallion} aria-hidden="true" />
      </div>
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonTrack} />
    </section>
  )

  const profileContent = (
    <div className={styles.profileStack}>
      <Suspense fallback={xpCardShell}>
        <DashboardXpCard userId={user.id} />
      </Suspense>
      <Suspense fallback={<PaintStreakSkeleton />}>
        <DashboardPaintStreak userId={user.id} />
      </Suspense>
      <DashboardHobbyBadges />

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardMetadataGrid userId={user.id} />
      </Suspense>
    </div>
  )

  const profileShell = (
    <div className={styles.profileStack}>
      {xpCardShell}
      <PaintStreakSkeleton />
      <DashboardHobbyBadges />
      <StatsSkeleton />
    </div>
  )

  const profilePanel =
    activeTab === 'profile' ? (
      profileContent
    ) : (
      <Suspense fallback={profileShell}>{profileContent}</Suspense>
    )
  const featureGuides = await getDashboardFeatureGuides()

  return (
    <WorkbenchShell
      contentClassName={styles.dashboardFrame}
      gutter="none"
      maxWidth="var(--og-workbench-compact-max-width)"
    >
      <DashboardActiveUnitsScreen
        featureGuides={featureGuides}
        initialTab={activeTab}
        profilePanel={profilePanel}
        userId={user.id}
      />
    </WorkbenchShell>
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
      ...guideMap.get(uid),
      ...dashboardFeatureGuideFallbacks[uid],
    }))
  } catch {
    return fallbackGuides
  }
}

function DashboardPreview({
  feed,
  featureGuides,
  metadata,
  nextActions,
  xpState,
}: {
  feed: Awaited<ReturnType<typeof getDashboardPaintingTableFeed>>
  featureGuides: DashboardFeatureGuide[]
  metadata: Awaited<ReturnType<typeof getDashboardMetadataSummary>>
  nextActions: Awaited<ReturnType<typeof getDashboardNextActions>>
  xpState: Awaited<ReturnType<typeof getDashboardXpState>>
}) {
  return (
    <DashboardV3Preview
      featureGuides={featureGuides}
      feed={feed}
      metadata={metadata}
      nextActions={nextActions}
      xpState={xpState}
    />
  )
}
