import { redirect } from 'next/navigation'
import GuidesV3Preview from './guides-v3-preview'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { getGuidesV3Payload } from './guides-v3-data'
import { getFeatureGuidesForPage } from '../components/feature-guide-data'
import { guidesFeatureGuides } from '../components/feature-guide-presets'

export default async function GuidesPage() {
  const perf = createPerfTimer('/guides')

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login?next=%2Fguides%3Fpreview%3D1&preview=1')
  }

  const [payload, featureGuides] = await perf.measure('v3 guides data', () =>
    Promise.all([
      getGuidesV3Payload(user.id),
      getFeatureGuidesForPage('/guides', guidesFeatureGuides),
    ])
  )

  perf.total()
  return <GuidesV3Preview featureGuides={featureGuides} initialPayload={payload} />
}
