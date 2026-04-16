import { notFound, redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import UnitDetailClient from './unit-detail-client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function UnitDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: unit, error: unitError } = await supabase
  .from('units')
  .select(`
    id,
    name,
    complexity,
    unit_size,
    is_active,
    project_id
  `)
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

  if (unitError || !unit) {
    notFound()
  }

  const { data: images, error: imagesError } = await supabase
  .from('image_assets')
  .select(`
    id,
    image_url,
    is_featured,
    created_at,
    sort_order,
    alt_text,
    storage_bucket,
    storage_path
  `)
  .eq('entity_type', 'unit')
  .eq('entity_id', id)
  .eq('user_id', user.id)
  .order('sort_order', { ascending: true })
  .order('created_at', { ascending: false })

  if (imagesError) {
    throw new Error(imagesError.message)
  }

  let { data: steps, error: stepsError } = await supabase
    .from('unit_progress_steps')
    .select(`
      id,
      step_key,
      step_label,
      step_order,
      status,
      progress
    `)
    .eq('unit_id', id)
    .order('step_order', { ascending: true })

  if (stepsError) {
    throw new Error(stepsError.message)
  }

  if (!steps || steps.length === 0) {
    const defaultSteps = [
      {
        unit_id: id,
        step_key: 'assembled',
        step_label: 'Assembled',
        step_order: 1,
        status: 'pending',
        progress: 0,
      },
      {
        unit_id: id,
        step_key: 'primed',
        step_label: 'Primed',
        step_order: 2,
        status: 'pending',
        progress: 0,
      },
      {
        unit_id: id,
        step_key: 'initial_paints',
        step_label: 'Initial Paints',
        step_order: 3,
        status: 'pending',
        progress: 0,
      },
      {
        unit_id: id,
        step_key: 'fine_details',
        step_label: 'Fine Details',
        step_order: 4,
        status: 'pending',
        progress: 0,
      },
      {
        unit_id: id,
        step_key: 'base_rim',
        step_label: 'Base & Rim',
        step_order: 5,
        status: 'pending',
        progress: 0,
      },
      {
        unit_id: id,
        step_key: 'done',
        step_label: 'Done',
        step_order: 6,
        status: 'pending',
        progress: 0,
      },
    ]

    const { error: insertStepsError } = await supabase
      .from('unit_progress_steps')
      .insert(defaultSteps)

    if (insertStepsError) {
      throw new Error(insertStepsError.message)
    }

    const reloadSteps = await supabase
      .from('unit_progress_steps')
      .select(`
        id,
        step_key,
        step_label,
        step_order,
        status,
        progress
      `)
      .eq('unit_id', id)
      .order('step_order', { ascending: true })

    if (reloadSteps.error) {
      throw new Error(reloadSteps.error.message)
    }

    steps = reloadSteps.data ?? []
  }

    let { data: sessions, error: sessionsError } = await supabase
  .from('unit_sessions')
  .select(`
    id,
    started_at,
    ended_at,
    duration_seconds,
    user_id
  `)
  .eq('unit_id', id)
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })

  if (sessionsError) {
    throw new Error(sessionsError.message)
  }

  const activeSession =
    sessions?.find(
      (session) =>
        session.ended_at === null && session.user_id === user.id
    ) ?? null

  if (activeSession) {
    const startedAtMs = new Date(activeSession.started_at).getTime()
    const nowMs = Date.now()
    const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000)

    if (elapsedSeconds >= 7200) {
      const forcedEndAt = new Date(startedAtMs + 7200 * 1000).toISOString()

      const { error: expireError } = await supabase
        .from('unit_sessions')
        .update({
          ended_at: forcedEndAt,
          duration_seconds: 7200,
        })
        .eq('id', activeSession.id)

      if (expireError) {
        throw new Error(expireError.message)
      }

      const reload = await supabase
  .from('unit_sessions')
  .select(`
    id,
    started_at,
    ended_at,
    duration_seconds,
    user_id
  `)
  .eq('unit_id', id)
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })

      if (reload.error) {
        throw new Error(reload.error.message)
      }

      sessions = reload.data
    }
  }

  const totalLoggedSeconds =
    sessions?.reduce((sum, session) => {
      return sum + (session.duration_seconds ?? 0)
    }, 0) ?? 0

  const currentActiveSession =
    sessions?.find(
      (session) =>
        session.ended_at === null && session.user_id === user.id
    ) ?? null
  const featuredImage =
    images?.find((img) => img.is_featured) ?? images?.[0] ?? null

  return (
    <UnitDetailClient
      unit={unit}
      images={images ?? []}
      featuredImage={featuredImage}
      steps={steps ?? []}
      totalLoggedSeconds={totalLoggedSeconds}
      activeSession={currentActiveSession}
      sessions={sessions ?? []}
    />  
  )
}