import { NextResponse } from 'next/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { cancelMonthlySubscription } from '../../../../lib/subscription/billing'

export async function POST() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  try {
    const result = await cancelMonthlySubscription(user.email)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ accessUntil: result.accessUntil })
  } catch (error) {
    console.error('[subscription/cancel] failed', error)
    return NextResponse.json(
      { error: 'Could not cancel right now. Try again in a moment.' },
      { status: 500 }
    )
  }
}
