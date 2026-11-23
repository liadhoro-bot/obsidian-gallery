import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

// Supabase Cron calls the news routes with a shared secret. The proxy lets
// these paths through without a session, so this check is the only gate.
export function isNewsCronRequest(request: Request) {
  const expected = process.env.NEWS_INGEST_SECRET
  const provided = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || expected.length < 32 || !provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
