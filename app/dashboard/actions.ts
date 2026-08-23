'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { startUnitSession } from '../units/[id]/actions'
import { captureServerEvent } from '../../utils/analytics/server'

export async function startDashboardUnitSession(formData: FormData) {
  const unitId = String(formData.get('unitId') || '').trim()

  if (!unitId) {
    throw new Error('Missing unit id')
  }

  await startUnitSession(unitId)
  redirect(`/units/${unitId}?session=started`)
}

export async function setDashboardNextActionDone(
  actionId: string,
  isDone: boolean
) {
  void actionId
  void isDone

  return {
    ok: false,
    error: 'Onboarding actions complete automatically after the real app action succeeds.',
  }
}

export async function dismissDashboardNextActions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be logged in.' }
  }

  const { error } = await supabase
    .from('user_onboarding_flows')
    .update({
      dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: 'onboarding_flow_dismissed',
  })

  revalidatePath('/dashboard')
  return { ok: true }
}
