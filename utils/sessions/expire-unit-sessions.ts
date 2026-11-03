import type { createClient } from '../supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Painting timers stop counting after two hours. A user can run timers on
// several units at once, so each session is capped on its own; starting a
// timer elsewhere never closes this one.
export const MAX_TIMER_SESSION_SECONDS = 2 * 60 * 60

// A paused timer stops counting toward the cap, so it never expires on its
// own. One left paused this long is treated as abandoned and settled at the
// time it was paused.
export const MAX_PAUSED_SESSION_SECONDS = 12 * 60 * 60

export type TimedUnitSession = {
  started_at: string
  paused_at?: string | null
  paused_seconds?: number | null
}

export function capTimerSessionSeconds(seconds: number) {
  return Math.min(Math.max(0, seconds), MAX_TIMER_SESSION_SECONDS)
}

// Seconds actually painted in an open session: wall time since it started,
// minus finished pauses, frozen at paused_at while a pause is running.
export function getPaintedSeconds(session: TimedUnitSession, nowMs = Date.now()) {
  const startedMs = Date.parse(session.started_at)
  const pausedMs = session.paused_at ? Date.parse(session.paused_at) : NaN
  const untilMs = Number.isFinite(pausedMs) ? pausedMs : nowMs
  return Math.max(
    0,
    Math.floor((untilMs - startedMs) / 1000) - (session.paused_seconds ?? 0)
  )
}

// When a session that painted `durationSeconds` ends: the moment that much
// unpaused time had passed, or the start of the pause it is sitting in.
export function getSessionEndedAt(session: TimedUnitSession, durationSeconds: number) {
  if (session.paused_at) return new Date(session.paused_at).toISOString()
  return new Date(
    Date.parse(session.started_at) +
      ((session.paused_seconds ?? 0) + durationSeconds) * 1000
  ).toISOString()
}

// Closes every open session of the user that has painted past the two-hour
// cap (ending it at exactly the cap) or sat paused past the abandon limit.
// Sessions abandoned without pressing Stop otherwise stay open forever and
// log no time at all.
export async function closeExpiredUnitSessions(
  supabase: SupabaseServerClient,
  userId: string
) {
  const nowMs = Date.now()
  // No session can reach the cap sooner than two hours after it started.
  const cutoff = new Date(nowMs - MAX_TIMER_SESSION_SECONDS * 1000).toISOString()

  const { data: candidates, error } = await supabase
    .from('unit_sessions')
    .select('id, started_at, paused_at, paused_seconds')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('started_at', cutoff)

  if (error) {
    console.error('[sessions] Could not load expired sessions', error)
    return 0
  }

  const expired = (candidates ?? []).flatMap((session) => {
    const paintedSeconds = getPaintedSeconds(session, nowMs)

    if (paintedSeconds >= MAX_TIMER_SESSION_SECONDS) {
      return [{
        id: session.id,
        ended_at: getSessionEndedAt(
          { ...session, paused_at: null },
          MAX_TIMER_SESSION_SECONDS
        ),
        duration_seconds: MAX_TIMER_SESSION_SECONDS,
      }]
    }

    if (
      session.paused_at &&
      nowMs - Date.parse(session.paused_at) > MAX_PAUSED_SESSION_SECONDS * 1000
    ) {
      return [{
        id: session.id,
        ended_at: new Date(session.paused_at).toISOString(),
        duration_seconds: paintedSeconds,
      }]
    }

    return []
  })

  if (!expired.length) return 0

  const results = await Promise.all(
    expired.map((session) =>
      supabase
        .from('unit_sessions')
        .update({
          ended_at: session.ended_at,
          duration_seconds: session.duration_seconds,
          paused_at: null,
        })
        .eq('id', session.id)
        .eq('user_id', userId)
        .is('ended_at', null)
    )
  )

  for (const result of results) {
    if (result.error) console.error('[sessions] Could not close expired session', result.error)
  }

  return expired.length
}
