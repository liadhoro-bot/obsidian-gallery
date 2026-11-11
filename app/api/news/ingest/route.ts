import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { runNewsIngestion } from '../../../../lib/news/ingest/run'

// Called by the Supabase Cron job with a shared secret. The proxy lets this
// path through without a session, so the secret check here is the only gate.
export const maxDuration = 60

function secretMatches(provided: string, expected: string) {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const expected = process.env.NEWS_INGEST_SECRET
  const provided = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || expected.length < 32 || !provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const results = await runNewsIngestion({ trigger: 'schedule' })
    return NextResponse.json({
      ok: true,
      sources: results.map((result) => ({
        source: result.slug,
        status: result.status,
        new: result.itemsNew,
        duplicate: result.itemsDuplicate,
      })),
    })
  } catch (error) {
    console.error('News ingest run failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
