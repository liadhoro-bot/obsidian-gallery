import { V3SilverLoadingShell } from '../../components/v3-silver-loading-shell'

export default function ThemeDetailLoading() {
  return <V3SilverLoadingShell title="Theme" tabs={['Palette', 'Notes']} cardCount={3} />
}
