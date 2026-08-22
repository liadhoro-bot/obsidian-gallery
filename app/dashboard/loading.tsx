import { V3SilverLoadingShell } from '../components/v3-silver-loading-shell'

export default function DashboardLoading() {
  return (
    <V3SilverLoadingShell
      title="Dashboard"
      tabs={['Painting Table', 'My Progress']}
      cardCount={3}
    />
  )
}
