import { redirect } from 'next/navigation'
import PaintsWetPalettePreview from './paints-wet-palette-preview'
import { hasV3PreviewSession } from '../../../lib/v3-preview-server'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createPerfTimer } from '../../../utils/perf/server'
import { getPaintsV3Payload } from '../paints-v3-data'
import { getFeatureGuidesForPage } from '../../components/feature-guide-data'
import { paintsFeatureGuides } from '../../components/feature-guide-presets'

type PaintsWetPalettePageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function PaintsWetPalettePage({
  searchParams,
}: PaintsWetPalettePageProps) {
  const perf = createPerfTimer('/paints/wet-palette')
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (!isPreview) {
    redirect('/vault')
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login?next=%2Fpaints%2Fwet-palette%3Fpreview%3D1&preview=1')
  }

  const [payload, featureGuides] = await perf.measure('v3 paints wet palette data', () =>
    Promise.all([
      getPaintsV3Payload(user.id),
      getFeatureGuidesForPage('/paints', paintsFeatureGuides),
    ])
  )

  perf.total()
  return (
    <PaintsWetPalettePreview featureGuides={featureGuides} initialPayload={payload} />
  )
}
