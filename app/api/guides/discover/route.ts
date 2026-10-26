import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { getDiscoverPage, getDiscoverFacets } from '../../../guides/discover-data'
import { parseDiscoverQuery } from '../../../guides/shared/discover-query'
import { loadTagDirectory } from '../../../guides/tag-directory-data'
import { getFeatureGuidesForPage } from '../../../components/feature-guide-data'
import { guidesFeatureGuides } from '../../../components/feature-guide-presets'

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const query = parseDiscoverQuery(params)
  try {
    let result: unknown
    if (params.get('mode') === 'metadata') {
      const [directory, facets] = await Promise.all([loadTagDirectory(), getDiscoverFacets(query)])
      result = { directory, facets }
    } else if (params.get('mode') === 'facets') {
      result = await getDiscoverFacets(query)
    } else if (params.get('mode') === 'help') {
      result = { guides: await getFeatureGuidesForPage('/guides', guidesFeatureGuides) }
    } else {
      result = await getDiscoverPage(user.id, query)
    }
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Discover query failed', error)
    return Response.json({ error: 'Could not load guides. Please try again.' }, { status: 500 })
  }
}
