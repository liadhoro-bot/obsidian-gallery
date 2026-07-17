import {
  getDashboardCurrentUser,
  getDashboardMetadataSummary,
} from './dashboard-data'
import DashboardMetadataLoader from './dashboard-metadata-loader'

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
