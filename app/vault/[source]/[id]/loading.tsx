import { V3SilverLoadingShell } from '../../../components/v3-silver-loading-shell'

export default function PaintDetailLoading() {
  return <V3SilverLoadingShell title="Paint" tabs={['Details', 'Recipes']} cardCount={3} />
}
