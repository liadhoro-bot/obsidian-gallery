import { NextResponse } from 'next/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { getSubscriptionStatus } from '../../../../lib/subscription/subscription-guard'

export async function GET() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const status = await getSubscriptionStatus(user.email)

  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
