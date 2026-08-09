'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { startUnitSession } from '../units/[id]/actions'

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

  if (!actionId) {
    return { ok: false, error: 'Missing action id.' }
  }

  if (isDone) {
    const { error } = await supabase
      .from('user_onboarding_action_completions')
      .upsert(
        {
          user_id: user.id,
          flow_action_id: actionId,
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
      .eq('flow_action_id', actionId)

    if (error) {
      return { ok: false, error: error.message }
    }
  }

  await syncDashboardNextActionsCompletion(user.id)
  revalidatePath('/dashboard')

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

  revalidatePath('/dashboard')
  return { ok: true }
}

async function syncDashboardNextActionsCompletion(userId: string) {
  const supabase = await createClient()
  const { data: userFlow } = await supabase
    .from('user_onboarding_flows')
    .select('flow_name')
    .eq('user_id', userId)
    .maybeSingle<{ flow_name: string | null }>()

  if (!userFlow?.flow_name) {
    return
  }

  const { data: actionRows } = await supabase
    .from('onboarding_flow_actions')
    .select('id')
    .eq('flow_name', userFlow.flow_name)

  const actionIds = (actionRows ?? []).map((action) => action.id)

  if (!actionIds.length) {
    return
  }

  const { count } = await supabase
    .from('user_onboarding_action_completions')
    .select('flow_action_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('flow_action_id', actionIds)

  const isComplete = (count ?? 0) >= actionIds.length

  await supabase
    .from('user_onboarding_flows')
    .update({
      completed_at: isComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}
