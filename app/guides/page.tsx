import { redirect } from 'next/navigation'
import GuidesV3Preview from './guides-v3-preview'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { getGuidesV3Payload } from './guides-v3-data'

type GuidesPageProps = {
  searchParams?: Promise<{
    preview?: string
  }>
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const perf = createPerfTimer('/guides')
  const params = searchParams ? await searchParams : undefined
  const isPreview = await hasV3PreviewSession(params?.preview)

  if (!isPreview) {
    redirect('/recipes')
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login?next=%2Fguides%3Fpreview%3D1&preview=1')
  }

  const payload = await perf.measure('v3 guides data', () =>
    getGuidesV3Payload(user.id)
  )

  perf.total()
  return <GuidesV3Preview initialPayload={payload} />
}
