import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import { getTrialCacheTag } from '../../../../lib/subscription/subscription-guard'
import {
  TRIAL_LENGTH_DAYS,
  isPricingV2Active,
} from '../../../../lib/subscription/pricing'
import { TERMS_VERSION } from '../../../../lib/terms-version'

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  if (!isPricingV2Active()) {
    return NextResponse.json(
      { error: 'Free trials are not available yet.' },
      { status: 409 }
    )
  }

  const service = createServiceRoleClient()
  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + TRIAL_LENGTH_DAYS * DAY_MS)

  // One trial per account, ever: ON CONFLICT (user_id) DO NOTHING, so a
  // repeat call never resets or extends an existing trial.
  const { error: insertError } = await service.from('trials').upsert(
    {
      user_id: user.id,
      email: (user.email ?? '').trim().toLowerCase(),
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      terms_version: TERMS_VERSION,
    },
    { onConflict: 'user_id', ignoreDuplicates: true }
  )

  if (insertError) {
    console.error('[trial] start failed', insertError)
    return NextResponse.json(
      { error: 'Could not start your trial. Try again in a moment.' },
      { status: 500 }
    )
  }

  const { data, error: readError } = await service
    .from('trials')
    .select('ends_at')
    .eq('user_id', user.id)
    .single()

  if (readError || !data?.ends_at) {
    console.error('[trial] read after start failed', readError)
    return NextResponse.json(
      { error: 'Could not start your trial. Try again in a moment.' },
      { status: 500 }
    )
  }

  revalidateTag(getTrialCacheTag(user.id), { expire: 0 })

  return NextResponse.json(
    { endsAt: data.ends_at },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
