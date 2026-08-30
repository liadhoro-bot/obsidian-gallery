import { V3SilverLoadingShell } from '../../components/v3-silver-loading-shell'

export default function RecipeDetailLoading() {
  return <V3SilverLoadingShell title="Guide" tabs={['Steps', 'Paints']} cardCount={3} />
}
