import type { ReactNode } from 'react'
import { createPerfTimer } from '../../utils/perf/server'
import {
  getDashboardNextActions,
  getDashboardPaintingTableFeed,
} from './dashboard-data'
import { createDashboardActiveUnitsViewModel } from './dashboard-active-units-model'
import { dashboardActiveUnitsFixture } from './dashboard-active-units-fixture'
import DashboardActiveUnitsView from './dashboard-active-units-view'
import AchievementCollectionClient from './dashboard-achievements-client'
import DashboardMetadataCards, {
  type DashboardMetadataItem,
} from './dashboard-metadata-cards'
import styles from './dashboard-og.module.css'
import type { DashboardFeatureGuide } from './feature-guide-types'
import type { AchievementCollection } from '../../lib/achievements/types'

type ActiveTab = 'profile' | 'painting-table'

const fixtureMetadataItems: DashboardMetadataItem[] = [
  { id: 'painting-time', label: 'Painting Time', value: '42h', accent: 'neutral' },
  { id: 'painting-sessions', label: 'Painting Sessions', value: '31', accent: 'neutral' },
  { id: 'active-painting-days', label: 'Active Painting Days', value: '14', accent: 'neutral' },
  { id: 'average-session-duration', label: 'Avg Session Duration', value: '1h 18m', accent: 'neutral' },
  { id: 'longest-session', label: 'Longest Session', value: '3h 12m', accent: 'warm' },
  {
    id: 'painting-times',
    label: 'Painting Times',
    value: '',
    accent: 'neutral',
    paintingTimeBuckets: [
      { id: 'morning', label: 'Morning', count: 4, percent: 13, color: '#b96d3f' },
      { id: 'noon', label: 'Noon', count: 3, percent: 10, color: '#c99a55' },
      { id: 'afternoon', label: 'Afternoon', count: 8, percent: 26, color: '#8f7a45' },
      { id: 'evening', label: 'Evening', count: 12, percent: 39, color: '#526d72' },
      { id: 'late-night', label: 'Late-night', count: 4, percent: 13, color: '#39445e' },
    ],
  },
  { id: 'paints-owned', label: 'Paints Owned', value: '126', accent: 'neutral' },
  { id: 'paints-wishlisted', label: 'Paints Wishlisted', value: '18', accent: 'neutral' },
  { id: 'paint-brands-owned', label: 'Paint Brands Owned', value: '7', accent: 'neutral' },
  { id: 'most-used-paint', label: 'Most Used Paint', value: 'Citadel Abaddon Black', accent: 'warm' },
  { id: 'units-owned', label: 'Units Owned', value: '18', accent: 'neutral' },
  { id: 'units-completed', label: 'Units Completed', value: '6', accent: 'neutral' },
  { id: 'models-completed', label: 'Models Completed', value: '31', accent: 'neutral' },
  { id: 'collection-completed', label: 'Collection Completed', value: '33%', accent: 'neutral' },
]

const fixtureAchievementCollection: AchievementCollection = {
  earnedCount: 4,
  totalVisibleCount: 12,
  latestAchievement: {
    achievementId: 'fixture-first-finish',
    code: 'first_finish',
    name: 'First Finish',
    description: 'Completed your first miniature and sealed the record in the ledger.',
    curatorText: 'The first finished model is always heavier than it looks.',
    tier: 'gold',
    triggerKey: 'models_completed',
    sealImagePath: null,
    sealImageUrl: null,
    earned: true,
    earnedAt: '2026-08-25T12:00:00.000Z',
    seenAt: '2026-08-25T12:00:00.000Z',
    currentValue: 1,
    threshold: 1,
    progressPercent: 100,
    progressLabel: '1 / 1 models',
    isHidden: false,
    isMysteryLocked: false,
    sortOrder: 1,
  },
  unseenAchievements: [],
  achievements: [
    {
      achievementId: 'fixture-first-finish',
      code: 'first_finish',
      name: 'First Finish',
      description: 'Completed your first miniature and sealed the record in the ledger.',
      curatorText: 'The first finished model is always heavier than it looks.',
      tier: 'gold',
      triggerKey: 'models_completed',
      sealImagePath: null,
      sealImageUrl: null,
      earned: true,
      earnedAt: '2026-08-25T12:00:00.000Z',
      seenAt: '2026-08-25T12:00:00.000Z',
      currentValue: 1,
      threshold: 1,
      progressPercent: 100,
      progressLabel: '1 / 1 models',
      isHidden: false,
      isMysteryLocked: false,
      sortOrder: 1,
    },
    {
      achievementId: 'fixture-session-keeper',
      code: 'session_keeper',
      name: 'Session Keeper',
      description: 'Logged painting sessions with enough consistency to build momentum.',
      curatorText: 'Progress loves witnesses. You made one.',
      tier: 'silver',
      triggerKey: 'sessions_logged',
      sealImagePath: null,
      sealImageUrl: null,
      earned: true,
      earnedAt: '2026-08-24T12:00:00.000Z',
      seenAt: '2026-08-24T12:00:00.000Z',
      currentValue: 5,
      threshold: 5,
      progressPercent: 100,
      progressLabel: '5 / 5 sessions',
      isHidden: false,
      isMysteryLocked: false,
      sortOrder: 2,
    },
    {
      achievementId: 'fixture-paint-ledger',
      code: 'paint_ledger',
      name: 'Paint Ledger',
      description: 'Recorded the paints behind your recent progress.',
      curatorText: 'A recipe remembered is a future gift.',
      tier: 'red',
      triggerKey: 'paints_logged',
      sealImagePath: null,
      sealImageUrl: null,
      earned: true,
      earnedAt: '2026-08-23T12:00:00.000Z',
      seenAt: '2026-08-23T12:00:00.000Z',
      currentValue: 10,
      threshold: 10,
      progressPercent: 100,
      progressLabel: '10 / 10 paints',
      isHidden: false,
      isMysteryLocked: false,
      sortOrder: 3,
    },
    {
      achievementId: 'fixture-night-shift',
      code: 'night_shift',
      name: 'Night Shift',
      description: 'Painted late enough for the workbench light to earn its keep.',
      curatorText: null,
      tier: 'prismatic',
      triggerKey: 'late_sessions',
      sealImagePath: null,
      sealImageUrl: null,
      earned: true,
      earnedAt: '2026-08-22T12:00:00.000Z',
      seenAt: '2026-08-22T12:00:00.000Z',
      currentValue: 3,
      threshold: 3,
      progressPercent: 100,
      progressLabel: '3 / 3 sessions',
      isHidden: false,
      isMysteryLocked: false,
      sortOrder: 4,
    },
    {
      achievementId: 'fixture-locked',
      code: 'locked',
      name: 'Locked Achievement',
      description: 'Description locked.',
      curatorText: null,
      tier: 'silver',
      triggerKey: 'locked',
      sealImagePath: null,
      sealImageUrl: null,
      earned: false,
      earnedAt: null,
      seenAt: null,
      currentValue: null,
      threshold: 12,
      progressPercent: null,
      progressLabel: null,
      isHidden: false,
      isMysteryLocked: true,
      sortOrder: 5,
    },
  ],
  tierSummary: {
    red: { earned: 1, total: 3 },
    silver: { earned: 1, total: 4 },
    gold: { earned: 1, total: 3 },
    prismatic: { earned: 1, total: 2 },
  },
  unsupportedTriggers: [],
  evaluationError: null,
}

export async function DashboardActiveUnitsScreen({
  featureGuides = [],
  initialTab,
  profilePanel,
  userId,
}: {
  featureGuides?: DashboardFeatureGuide[]
  initialTab: ActiveTab
  profilePanel: ReactNode
  userId: string
}) {
  const perf = createPerfTimer('/dashboard:active-units-screen')
  const [feed, nextActions] = await perf.measure('active units view model', () =>
    Promise.all([
      getDashboardPaintingTableFeed(userId),
      getDashboardNextActions(userId),
    ])
  )
  perf.total()

  return (
    <DashboardActiveUnitsView
      featureGuides={featureGuides}
      initialTab={initialTab}
      model={createDashboardActiveUnitsViewModel({ feed, nextActions })}
      profilePanel={profilePanel}
    />
  )
}

export function DashboardActiveUnitsGoldenFixtureScreen() {
  return (
    <DashboardActiveUnitsView
      initialTab="painting-table"
      model={dashboardActiveUnitsFixture}
      profilePanel={<DashboardProgressFixturePanel />}
      source="fixture"
    />
  )
}

function DashboardProgressFixturePanel() {
  return (
    <div className={styles.profileStack}>
      <AchievementCollectionClient collection={fixtureAchievementCollection} />
      <DashboardMetadataCards items={fixtureMetadataItems} />
    </div>
  )
}
