import { V3SilverLoadingShell } from '../components/v3-silver-loading-shell'

export default function RecipesLoading() {
  return <V3SilverLoadingShell title="Guides" tabs={['Browse', 'Mine']} cardCount={4} />
}
