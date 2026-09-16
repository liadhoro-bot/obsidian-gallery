import { NextResponse } from 'next/server'
import { getPaintsV3Payload } from '../../../paints/paints-v3-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ libraryPaints: [] }, { status: 401 })
  }

  const payload = await getPaintsV3Payload(user.id, {
    includeSwatchImages: false,
  })

  return NextResponse.json({
    counts: payload.counts,
    filters: payload.filters,
    libraryPaints: payload.libraryPaints,
  })
}
