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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be logged in.' }
  }

  const { data: action, error: actionError } = await supabase
    .from('onboarding_flow_actions')
    .select('id, flow_name, action_key')
    .eq('id', actionId)
    .maybeSingle<{ id: string; flow_name: string; action_key: string }>()

  if (actionError) {
    return { ok: false, error: actionError.message }
  }

  if (!action) {
    return { ok: false, error: 'Next action no longer exists.' }
  }

  const { data: userFlow, error: flowError } = await supabase
    .from('user_onboarding_flows')
    .select('flow_name, completed_at, dismissed_at')
    .eq('user_id', user.id)
    .maybeSingle<{
      flow_name: string | null
      completed_at: string | null
      dismissed_at: string | null
    }>()

  if (flowError) {
    return { ok: false, error: flowError.message }
  }

  if (
    !userFlow?.flow_name ||
    userFlow.flow_name !== action.flow_name ||
    userFlow.completed_at ||
    userFlow.dismissed_at
  ) {
    return { ok: false, error: 'This next action is not active.' }
  }

  if (isDone) {
    const { error } = await supabase
      .from('user_onboarding_action_completions')
      .upsert(
        {
          user_id: user.id,
          flow_action_id: action.id,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,flow_action_id' }
      )

    if (error) {
      return { ok: false, error: error.message }
    }
  } else {
    const { error } = await supabase
      .from('user_onboarding_action_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('flow_action_id', action.id)

    if (error) {
      return { ok: false, error: error.message }
    }
  }

  await captureServerEvent({
    distinctId: user.id,
    event: isDone
      ? 'dashboard_next_action_checked'
      : 'dashboard_next_action_unchecked',
    properties: {
      action_key: action.action_key,
      flow_name: action.flow_name,
    },
  })

  return { ok: true }
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
