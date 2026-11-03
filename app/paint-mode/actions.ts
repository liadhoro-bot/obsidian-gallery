'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'
import {
  closeExpiredUnitSessions,
  getPaintedSeconds,
} from '../../utils/sessions/expire-unit-sessions'

export type PaintModeSessionTiming = {
  id: string
  startedAt: string
  pausedAt: string | null
  pausedSeconds: number
}

async function requireSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const user = await getSessionUser(supabase)

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

async function getOpenSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  unitId: string
) {
  const { data, error } = await supabase
    .from('unit_sessions')
    .select('id, started_at, paused_at, paused_seconds')
    .eq('unit_id', unitId)
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

function toTiming(row: {
  id: string
  started_at: string
  paused_at: string | null
  paused_seconds: number | null
}): PaintModeSessionTiming {
  return {
    id: row.id,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    pausedSeconds: row.paused_seconds ?? 0,
  }
}

export async function pausePaintSession(unitId: string) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  await closeExpiredUnitSessions(supabase, user.id)
  const session = await getOpenSession(supabase, user.id, unitId)

  if (!session) return null
  if (session.paused_at) return toTiming(session)

  const { data, error } = await supabase
    .from('unit_sessions')
    .update({ paused_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .select('id, started_at, paused_at, paused_seconds')
    .single()

  if (error) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'session_paused',
    properties: {
      unit_id: unitId,
      surface: 'paint_mode',
      painted_seconds: getPaintedSeconds(data),
    },
  })

  revalidatePath(`/units/${unitId}`)
  return toTiming(data)
}

export async function resumePaintSession(unitId: string) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)

  await closeExpiredUnitSessions(supabase, user.id)
  const session = await getOpenSession(supabase, user.id, unitId)

  if (!session) return null
  if (!session.paused_at) return toTiming(session)

  const pausedFor = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(session.paused_at)) / 1000)
  )

  const { data, error } = await supabase
    .from('unit_sessions')
    .update({
      paused_at: null,
      paused_seconds: (session.paused_seconds ?? 0) + pausedFor,
    })
    .eq('id', session.id)
    .eq('user_id', user.id)
    .is('ended_at', null)
    .select('id, started_at, paused_at, paused_seconds')
    .single()

  if (error) throw error

  await captureServerEvent({
    distinctId: user.id,
    event: 'session_resumed',
    properties: {
      unit_id: unitId,
      surface: 'paint_mode',
      paused_seconds: pausedFor,
    },
  })

  revalidatePath(`/units/${unitId}`)
  return toTiming(data)
}

// The unit's own note (units.notes) - the same field the unit Details tab
// shows, so a note written mid-session stays with the unit.
export async function saveUnitNote(unitId: string, notes: string) {
  const supabase = await createClient()
  const user = await requireSessionUser(supabase)
  const trimmed = notes.trim()

  const { error } = await supabase
    .from('units')
    .update({ notes: trimmed || null })
    .eq('id', unitId)
    .eq('user_id', user.id)

  if (error) throw error

  revalidatePath(`/units/${unitId}`)
  return { notes: trimmed }
}
