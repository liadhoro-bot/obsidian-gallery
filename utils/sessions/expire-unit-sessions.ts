import type { createClient } from '../supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Painting timers stop counting after two hours. A user can run timers on
// several units at once, so each session is capped on its own; starting a
// timer elsewhere never closes this one.
export const MAX_TIMER_SESSION_SECONDS = 2 * 60 * 60

export function capTimerSessionSeconds(seconds: number) {
  return Math.min(Math.max(0, seconds), MAX_TIMER_SESSION_SECONDS)
}

// Closes every open session of the user that started more than two hours ago,
// ending it at exactly started_at + 2h. Sessions abandoned without pressing
// Stop otherwise stay open forever and log no time at all.
export async function closeExpiredUnitSessions(
  supabase: SupabaseServerClient,
  userId: string
) {
  const cutoff = new Date(Date.now() - MAX_TIMER_SESSION_SECONDS * 1000).toISOString()

  const { data: expired, error } = await supabase
    .from('unit_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .lt('started_at', cutoff)

  if (error) {
    console.error('[sessions] Could not load expired sessions', error)
    return 0
  }

  if (!expired?.length) return 0

  const results = await Promise.all(
    expired.map((session) =>
      supabase
        .from('unit_sessions')
        .update({
          ended_at: new Date(
            Date.parse(session.started_at) + MAX_TIMER_SESSION_SECONDS * 1000
          ).toISOString(),
          duration_seconds: MAX_TIMER_SESSION_SECONDS,
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
