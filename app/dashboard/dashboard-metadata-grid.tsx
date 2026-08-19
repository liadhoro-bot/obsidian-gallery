import {
  getDashboardCurrentUser,
  getDashboardMetadataSummary,
} from './dashboard-data'
import DashboardMetadataLoader, {
  DashboardPaintStreakLoader,
} from './dashboard-metadata-loader'

export default async function DashboardMetadataGrid({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id

  if (!resolvedUserId) {
    return null
  }

  const metadataSummary = await getDashboardMetadataSummary(resolvedUserId)

  return <DashboardMetadataLoader initialSummary={metadataSummary} />
}

export async function DashboardPaintStreak({
  userId,
}: {
  userId?: string
}) {
  const resolvedUserId = userId ?? (await getDashboardCurrentUser())?.id

  if (!resolvedUserId) {
    return null
  }

  const metadataSummary = await getDashboardMetadataSummary(resolvedUserId)

  return <DashboardPaintStreakLoader initialSummary={metadataSummary} />
}
