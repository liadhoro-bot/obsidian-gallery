import type { ReactNode } from 'react'
import { createPerfTimer } from '../../utils/perf/server'
import {
  getDashboardNextActions,
  getDashboardPaintingTableFeed,
} from './dashboard-data'
import { createDashboardActiveUnitsViewModel } from './dashboard-active-units-model'
import { dashboardActiveUnitsFixture } from './dashboard-active-units-fixture'
import DashboardActiveUnitsView from './dashboard-active-units-view'
import DashboardHobbyBadges from './dashboard-hobby-badges'
import DashboardMetadataCards, {
  DashboardPaintStreakCard,
  type DashboardMetadataItem,
} from './dashboard-metadata-cards'
import styles from './dashboard-og.module.css'
import { DashboardXpLedgerCard } from './dashboard-xp-card'
import type { DashboardFeatureGuide } from './feature-guide-types'

type ActiveTab = 'profile' | 'painting-table'

const fixtureMetadataItems: DashboardMetadataItem[] = [
  { id: 'total-units', label: 'Total Units', value: '18', accent: 'neutral' },
  { id: 'time-logged', label: 'Time Logged', value: '42h', accent: 'neutral' },
  { id: 'colors', label: 'Colors', value: '126', accent: 'neutral' },
  { id: 'average-session-length', label: 'Avg Session', value: '1h 18m', accent: 'neutral' },
  { id: 'weekly-sessions', label: 'Sessions/Wk', value: '4', accent: 'warm' },
  { id: 'completed', label: 'Completed', value: '31', accent: 'neutral' },
]

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
      <DashboardXpLedgerCard
        currentLevel={7}
        progressPercent={64}
        xpIntoLevel={640}
        xpNeededForLevel={1000}
        xpToNextLevel={360}
      />
      <DashboardPaintStreakCard paintStreak="9d" sessionLabel="1d 6h" />
      <DashboardHobbyBadges />
      <DashboardMetadataCards items={fixtureMetadataItems} />
    </div>
  )
}
