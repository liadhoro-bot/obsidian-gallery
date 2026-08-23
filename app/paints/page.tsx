import { redirect } from 'next/navigation'
import PaintsV3Preview from './paints-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { getPaintsV3Payload } from './paints-v3-data'
import { getFeatureGuidesForPage } from '../components/feature-guide-data'
import { paintsFeatureGuides } from '../components/feature-guide-presets'

type PaintsPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function PaintsPage({ searchParams }: PaintsPageProps) {
  const perf = createPerfTimer('/paints')
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (!isPreview) {
    redirect('/vault')
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login?next=%2Fpaints%3Fpreview%3D1&preview=1')
  }

  const [payload, featureGuides] = await perf.measure('v3 paints data', () =>
    Promise.all([
      getPaintsV3Payload(user.id),
      getFeatureGuidesForPage('/paints', paintsFeatureGuides),
    ])
  )

  perf.total()
  return <PaintsV3Preview featureGuides={featureGuides} initialPayload={payload} />
}
