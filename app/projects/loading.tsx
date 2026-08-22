import { V3SilverLoadingShell } from '../components/v3-silver-loading-shell'

export default function ProjectsLoading() {
  return (
    <V3SilverLoadingShell
      title="Projects"
      tabs={['Projects', 'Units']}
      cardCount={3}
    />
  )
}
