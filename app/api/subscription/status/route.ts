import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import {
  getSubscriptionCacheTag,
  getSubscriptionStatus,
} from '../../../../lib/subscription/subscription-guard'

export async function GET() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const status = await getSubscriptionStatus(user.email)
  if (status.isActive) {
    revalidateTag(getSubscriptionCacheTag(user.email), { expire: 0 })
  }

  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
