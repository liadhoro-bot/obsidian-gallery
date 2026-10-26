import { redirect } from 'next/navigation'
import GuidesV3Preview from './guides-v3-preview'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { getGuidesV3Payload } from './guides-v3-data'
import { loadGuideFolders } from './folder-actions'
import { loadTagDirectory } from './tag-directory-data'
import { getFeatureGuidesForPage } from '../components/feature-guide-data'
import { guidesFeatureGuides } from '../components/feature-guide-presets'
import { getDiscoverPage } from './discover-data'
import { parseDiscoverQuery } from './shared/discover-query'

export default async function GuidesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const perf = createPerfTimer('/guides')

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login?next=%2Fguides%3Fpreview%3D1&preview=1')
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  }
  const tab = params.get('tab')
  const initialTab = tab === 'saved' ? 'saved' : tab === 'guides' || tab === 'decks' ? 'guides' : 'library'
  if (initialTab === 'library') {
    const query = parseDiscoverQuery(params)
    const discover = await perf.measure('discover summaries (nine)', () => getDiscoverPage(user.id, query))
    perf.total()
    return <GuidesV3Preview key="library" initialTab="library" initialDiscover={discover} initialDiscoverQuery={query} />
  }

  // Personal collections, folders and editor data load only when that tab opens.
  const [payload, featureGuides, guideFolders, tagDirectory] = await perf.measure('v3 guides data', () =>
    Promise.all([
      getGuidesV3Payload(user.id, 'collection'),
      getFeatureGuidesForPage('/guides', guidesFeatureGuides),
      loadGuideFolders(),
      loadTagDirectory(),
    ])
  )

  perf.total()
  return <GuidesV3Preview key={initialTab} initialTab={initialTab} initialCreate={params.get('create') === '1'} featureGuides={featureGuides} initialPayload={payload} guideFolders={guideFolders} tagDirectory={tagDirectory} />
}
