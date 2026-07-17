import { NextResponse } from 'next/server'
import { getDashboardMetadataSummary } from '../../../dashboard/dashboard-data'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ summary: null }, { status: 401 })
  }

  const summary = await getDashboardMetadataSummary(user.id)

  return NextResponse.json({
    summary,
  })
}
