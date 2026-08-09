import { getDashboardNextActions } from './dashboard-data'
import DashboardNextActionsCard from './dashboard-next-actions-card'

export default async function DashboardNextActions({
  userId,
}: {
  userId: string
}) {
  const nextActions = await getDashboardNextActions(userId)

  if (!nextActions) {
    return null
  }

  return <DashboardNextActionsCard state={nextActions} />
}
