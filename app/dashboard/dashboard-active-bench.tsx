import type { DashboardFeedUnit } from './dashboard-data'
import DashboardUnitStatusList, {
  type DashboardStatusUnit,
  type UnitStatus,
} from './dashboard-unit-status-list'

export default function DashboardActiveBench({
  units,
}: {
  units: DashboardFeedUnit[]
}) {
  if (!units.length) {
    return <DashboardUnitStatusList units={[]} />
  }

  const displayUnits: DashboardStatusUnit[] = [...units]
    .sort((a, b) => {
      const createdAtSort =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

      if (a.deadline && b.deadline) {
        const deadlineSort =
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()

        return deadlineSort || createdAtSort
      }

      if (a.deadline) return -1
      if (b.deadline) return 1

      const aLastSession = a.last_session_at
      const bLastSession = b.last_session_at

      if (aLastSession && bLastSession) {
        const sessionSort =
          new Date(bLastSession).getTime() -
          new Date(aLastSession).getTime()

        return sessionSort || createdAtSort
      }

      if (aLastSession) return -1
      if (bLastSession) return 1

      return createdAtSort
    })
    .map((unit) => ({
      id: unit.unit_id,
      name: unit.name,
      deadline: unit.deadline,
      created_at: unit.created_at,
      status: unit.status as UnitStatus,
      progress: unit.progress_percent ?? 0,
      imageUrl: unit.primary_image_url || null,
      lastSession: unit.last_session_at || null,
    }))

  return (
    <section className="min-h-[188px]">
      <DashboardUnitStatusList units={displayUnits} />
    </section>
  )
}
