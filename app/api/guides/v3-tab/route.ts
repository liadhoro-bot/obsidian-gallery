import { NextResponse, type NextRequest } from 'next/server'
import { getGuidesV3Payload, type GuidesV3Tab } from '../../../guides/guides-v3-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

const VALID_TABS = new Set<GuidesV3Tab>(['library', 'guides', 'decks'])

export async function GET(request: NextRequest) {
  const tabValue = request.nextUrl.searchParams.get('tab')
  if (!tabValue || !VALID_TABS.has(tabValue as GuidesV3Tab)) {
    return NextResponse.json({ error: 'Invalid Guides tab.' }, { status: 400 })
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const payload = await getGuidesV3Payload(user.id, tabValue as GuidesV3Tab)
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
