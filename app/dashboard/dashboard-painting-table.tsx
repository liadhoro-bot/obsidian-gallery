import { createPerfTimer } from '../../utils/perf/server'
import { getDashboardCurrentUser } from './dashboard-data'
import DashboardActiveBench from './dashboard-active-bench'
import { getDashboardPaintingTableFeed } from './dashboard-data'
import DashboardUnitInProgress from './dashboard-unit-in-progress'

export default async function DashboardPaintingTable({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id

  if (!resolvedUserId) {
    return null
  }

  const perf = createPerfTimer('/dashboard:painting-table')
  const { heroUnit, units } = await perf.measure('feed query', () =>
    getDashboardPaintingTableFeed(resolvedUserId)
  )
  perf.total()

  return (
    <>
      <DashboardUnitInProgress unit={heroUnit} />
      <DashboardActiveBench units={units} />
    </>
  )
}
