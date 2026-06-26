import { NextResponse } from 'next/server'
import { getDashboardMetadataSummary } from '../../../dashboard/dashboard-data'
import { createClient } from '../../../../utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 })
  }

  const summary = await getDashboardMetadataSummary(user.id)

  return NextResponse.json({
    items: [
      {
        id: 'time-logged',
        value: summary.timeLogged,
        accent: 'text-white',
      },
      {
        id: 'average-session-length',
        value: summary.averageSessionLength,
        accent: 'text-white',
      },
      {
        id: 'weekly-sessions',
        value: summary.weeklySessions,
        accent: 'text-orange-400',
      },
      {
        id: 'since-last-session',
        value: summary.timeSinceLastSession,
        accent: 'text-white',
      },
      {
        id: 'paint-streak',
        value: summary.paintStreak,
        accent: 'text-orange-400',
      },
    ],
  })
}
