import { NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'
import { getTrialCacheTag } from '../../../../lib/subscription/subscription-guard'
import {
  TRIAL_LENGTH_DAYS,
  isPricingV2Active,
} from '../../../../lib/subscription/pricing'
import { sendTrialStartedNotification } from '../../../../lib/subscription/trial-notification'
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
  // RETURNING only yields a row when this call actually created the trial.
  const email = (user.email ?? '').trim().toLowerCase()
  const { data: inserted, error: insertError } = await service
    .from('trials')
    .upsert(
      {
        user_id: user.id,
        email,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
        terms_version: TERMS_VERSION,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
    .select('started_at, ends_at')

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

  const createdTrial = inserted?.[0]
  if (createdTrial) {
    // Notify the admin after responding so the user isn't kept waiting.
    after(() =>
      sendTrialStartedNotification({
        userId: user.id,
        email,
        startedAt: createdTrial.started_at,
        endsAt: createdTrial.ends_at,
      })
    )
  }

  return NextResponse.json(
    { endsAt: data.ends_at },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
