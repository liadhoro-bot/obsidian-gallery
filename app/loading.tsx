import { V3SilverLoadingShell } from './components/v3-silver-loading-shell'

export default function AppLoading() {
  return <V3SilverLoadingShell title="Obsidian" tabs={['Workspace', 'Gallery']} cardCount={3} />
}
