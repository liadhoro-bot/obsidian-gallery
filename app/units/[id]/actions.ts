'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'

export async function toggleUnitActive(unitId: string, nextValue: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('units')
    .update({ is_active: nextValue })
    .eq('id', unitId)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath('/dashboard')
  revalidatePath('/projects')
}

export async function startUnitSession(unitId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: existing, error: existingError } = await supabase
    .from('unit_sessions')
    .select('id')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await supabase
    .from('unit_sessions')
    .insert({
      unit_id: unitId,
      user_id: user.id,
      started_at: new Date().toISOString(),
    })
    .select('id, started_at')
    .single()

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  return data
}

export async function endUnitSession(unitId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: session, error: sessionError } = await supabase
    .from('unit_sessions')
    .select('id, started_at')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }

  if (!session) {
    return null
  }

  const started = new Date(session.started_at).getTime()
  const ended = Date.now()
  const durationSeconds = Math.max(0, Math.floor((ended - started) / 1000))

  const { error } = await supabase
    .from('unit_sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq('id', session.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath('/dashboard')
  revalidatePath('/projects')

  return { durationSeconds }
}

export async function updateProgressStep(
  unitId: string,
  stepId: string,
  status: 'pending' | 'in_progress' | 'done',
  progress: number
) {
  const supabase = await createClient()

  const safeProgress = Math.max(0, Math.min(100, progress))

  const { error } = await supabase
    .from('unit_progress_steps')
    .update({
      status,
      progress: safeProgress,
    })
    .eq('id', stepId)
    .eq('unit_id', unitId)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
}

export async function setFeaturedUnitImage(unitId: string, imageId: string) {
  const supabase = await createClient()

  const { error: clearError } = await supabase
    .from('image_assets')
    .update({ is_featured: false })
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)

  if (clearError) {
    throw clearError
  }

  const { error: setError } = await supabase
    .from('image_assets')
    .update({ is_featured: true })
    .eq('id', imageId)
    .eq('entity_type', 'unit')
    .eq('entity_id', unitId)

  if (setError) {
    throw setError
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath('/dashboard')
  revalidatePath('/projects')
}

export async function updateUnitDetails(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const unitId = String(formData.get('unitId') ?? '')
  const complexityRaw = String(formData.get('complexity') ?? '').trim()
  const unitSizeRaw = String(formData.get('unit_size') ?? '').trim()
  const deadlineRaw = String(formData.get('deadline') ?? '').trim()

  if (!unitId) {
    throw new Error('Missing unit ID')
  }

  const complexity = complexityRaw ? Number(complexityRaw) : null
  const unitSize = unitSizeRaw ? Number(unitSizeRaw) : null
  const deadline = deadlineRaw || null

  if (complexity !== null && (!Number.isFinite(complexity) || complexity < 1 || complexity > 5)) {
    throw new Error('Complexity must be between 1 and 5')
  }

  if (unitSize !== null && (!Number.isFinite(unitSize) || unitSize < 1)) {
    throw new Error('Unit size must be a positive number')
  }

  const { error } = await supabase
    .from('units')
    .update({
      complexity,
      unit_size: unitSize,
      deadline,
    })
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath('/dashboard')
  revalidatePath('/')
  revalidatePath('/projects')
}

export async function expireUnitSessionAtTwoHours(unitId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data: session, error: sessionError } = await supabase
    .from('unit_sessions')
    .select('id, started_at')
    .eq('unit_id', unitId)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sessionError) {
    throw sessionError
  }

  if (!session) {
    return null
  }

  const startedAt = new Date(session.started_at)
  const forcedEndAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('unit_sessions')
    .update({
      ended_at: forcedEndAt.toISOString(),
      duration_seconds: 7200,
    })
    .eq('id', session.id)

  if (error) {
    throw error
  }

  revalidatePath(`/units/${unitId}`)
  revalidatePath('/dashboard')
  revalidatePath('/')
  revalidatePath('/projects')

  return { durationSeconds: 7200 }
}

export async function toggleStepDone(formData: FormData) {
  const supabase = await createClient()

  const stepId = formData.get('stepId')?.toString()
  const unitId = formData.get('unitId')?.toString()
  const nextStatus = formData.get('nextStatus')?.toString()

  if (!stepId || !unitId || !nextStatus) return

  const progress = nextStatus === 'done' ? 100 : 0

  await supabase
    .from('unit_progress_steps')
    .update({
      status: nextStatus,
      progress,
    })
    .eq('id', stepId)

  const { data: allSteps, error } = await supabase
    .from('unit_progress_steps')
    .select('id, step_key, status')
    .eq('unit_id', unitId)

  if (!error && allSteps) {
    const visibleSteps = allSteps.filter((step) => step.step_key !== 'done')
    const allVisibleDone =
      visibleSteps.length > 0 &&
      visibleSteps.every((step) => step.status === 'done')

    await supabase
      .from('unit_progress_steps')
      .update({
        status: allVisibleDone ? 'done' : 'pending',
        progress: allVisibleDone ? 100 : 0,
      })
      .eq('unit_id', unitId)
      .eq('step_key', 'done')
  }

  revalidatePath(`/units/${unitId}`)
}