import type { ReactNode } from 'react'
import { createPerfTimer } from '../../utils/perf/server'
import {
  getDashboardNextActions,
  getDashboardPaintingTableFeed,
} from './dashboard-data'
import { createDashboardActiveUnitsViewModel } from './dashboard-active-units-model'
import { dashboardActiveUnitsFixture } from './dashboard-active-units-fixture'
import DashboardActiveUnitsView from './dashboard-active-units-view'

type ActiveTab = 'profile' | 'painting-table'

export async function DashboardActiveUnitsScreen({
  initialTab,
  profilePanel,
  userId,
}: {
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
      profilePanel={null}
    />
  )
}
