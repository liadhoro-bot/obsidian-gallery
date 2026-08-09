import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { WorkbenchShell } from '@/src/components/v3'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import DashboardV3Preview from './dashboard-v3-preview'
import DashboardXpCard from './dashboard-xp-card'
import DashboardMetadataGrid from './dashboard-metadata-grid'
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
import { StatsSkeleton } from './dashboard-skeletons'

type DashboardPageProps = {
  searchParams?: Promise<{
    golden?: string
    preview?: string
    tab?: string
  }>
}

const dashboardFeatureGuideOrder = [
  'dashboard.help',
  'dashboard.add_next_action',
  'dashboard.next_actions.panel',
  'dashboard.featured_unit',
  'dashboard.resume_painting',
] as const

const dashboardFeatureGuideFallbacks: Record<
  (typeof dashboardFeatureGuideOrder)[number],
  DashboardFeatureGuide
> = {
  'dashboard.help': {
    uid: 'dashboard.help',
    feature_name: 'Dashboard explainer',
    location_reference: 'Dashboard header > ?',
    component_reference: 'app/dashboard/dashboard-v3-preview.tsx',
    explanation:
      'Explains what the dashboard is for: a quick check-in view for active units, next actions, and painting progress.',
    place_in_page: 'Dashboard header',
    coach_mark_area: 'The question mark button in the Dashboard header',
    popup_placement: 'bottom-end',
    display_order: 110,
  },
  'dashboard.add_next_action': {
    uid: 'dashboard.add_next_action',
    feature_name: 'Add next action',
    location_reference: 'Dashboard header > +',
    component_reference: 'app/dashboard/dashboard-v3-preview.tsx',
    explanation:
      'Adds a new dashboard task to the next action list so the user has one more concrete step to follow.',
    place_in_page: 'Dashboard header',
    coach_mark_area: 'The plus button beside the Dashboard help button',
    popup_placement: 'bottom-end',
    display_order: 120,
  },
  'dashboard.next_actions.panel': {
    uid: 'dashboard.next_actions.panel',
    feature_name: 'Next actions panel',
    location_reference: 'Dashboard > Next Actions',
    component_reference: 'app/dashboard/dashboard-next-actions-card.tsx',
    explanation:
      'A short guided checklist chosen from the user onboarding goal. Each action has a completion control, a breadcrumb, and a route to the exact place to act.',
    place_in_page: 'Near top of Active Units dashboard',
    coach_mark_area: 'The whole next actions card',
    popup_placement: 'bottom',
    display_order: 150,
  },
  'dashboard.featured_unit': {
    uid: 'dashboard.featured_unit',
    feature_name: 'Featured unit',
    location_reference: 'Dashboard > Featured Unit',
    component_reference: 'app/dashboard/dashboard-unit-in-progress.tsx',
    explanation:
      'Highlights the unit the user is currently focusing on, including progress, stage, time logged, and a resume route.',
    place_in_page: 'Active Units dashboard',
    coach_mark_area: 'The large featured unit card',
    popup_placement: 'top',
    display_order: 210,
  },
  'dashboard.resume_painting': {
    uid: 'dashboard.resume_painting',
    feature_name: 'Resume painting',
    location_reference: 'Dashboard > Featured Unit > Resume',
    component_reference: 'app/dashboard/dashboard-resume-button.tsx',
    explanation:
      'Opens the active unit so the user can continue recording stages, photos, paints, and sessions.',
    place_in_page: 'Featured unit card',
    coach_mark_area: 'The Resume button on a unit card',
    popup_placement: 'left',
    display_order: 220,
  },
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const perf = createPerfTimer('/dashboard')
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(resolvedSearchParams?.preview)
  const isGoldenFixture =
    resolvedSearchParams?.golden === 'dashboard-active-units' &&
    process.env.NODE_ENV !== 'production'

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

  const profilePanel =
    activeTab === 'profile' ? (
      profileContent
    ) : (
      <Suspense fallback={profileShell}>{profileContent}</Suspense>
    )

  return (
    <WorkbenchShell
      contentClassName={styles.dashboardFrame}
      gutter="none"
      maxWidth="var(--og-workbench-compact-max-width)"
    >
      <DashboardActiveUnitsScreen
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

    return dashboardFeatureGuideOrder.map(
      (uid) => guideMap.get(uid) ?? dashboardFeatureGuideFallbacks[uid]
    )
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
