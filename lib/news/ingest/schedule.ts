import { SourceFetchError } from './safe-fetch'

const MAX_BACKOFF_STEPS = 4

// A source is due once its polling interval has passed. Each consecutive
// failure doubles the wait (up to 16x), so a broken site isn't hammered.
export function isSourceDue(
  source: { last_attempt_at: string | null; poll_interval_minutes: number; consecutive_failures: number },
  now: Date
) {
  if (!source.last_attempt_at) return true
  const backoff = 2 ** Math.min(source.consecutive_failures, MAX_BACKOFF_STEPS)
  const waitMs = source.poll_interval_minutes * 60_000 * backoff
  return now.getTime() - new Date(source.last_attempt_at).getTime() >= waitMs
}

// Error text that's safe to store and show to editors: our own messages for
// fetch problems, a trimmed message for anything else.
export function describeIngestError(error: unknown) {
  if (error instanceof SourceFetchError) return error.message.slice(0, 300)
  const message = error instanceof Error ? error.message : String(error)
  return `Unexpected error: ${message}`.slice(0, 300)
}

// Runs each task on its own, so one source failing (or throwing somewhere
// unexpected) never stops the others.
export async function runIsolated<T, R>(
  tasks: T[],
  run: (task: T) => Promise<R>,
  onError: (task: T, error: unknown) => R,
  shouldContinue: () => boolean = () => true
): Promise<R[]> {
  const results: R[] = []
  for (const task of tasks) {
    if (!shouldContinue()) break
    try {
      results.push(await run(task))
    } catch (error) {
      results.push(onError(task, error))
    }
  }
  return results
}
