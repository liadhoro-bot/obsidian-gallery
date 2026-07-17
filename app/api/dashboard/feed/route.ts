import { NextResponse } from 'next/server'
import { getDashboardPaintingTableFeed } from '../../../dashboard/dashboard-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ heroUnit: null, units: [] }, { status: 401 })
  }

  const feed = await getDashboardPaintingTableFeed(user.id)

  return NextResponse.json(feed)
}
