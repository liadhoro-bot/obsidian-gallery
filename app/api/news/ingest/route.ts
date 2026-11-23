import { NextResponse } from 'next/server'
import { isNewsCronRequest } from '../../../../lib/news/cron-auth'
import { runNewsIngestion } from '../../../../lib/news/ingest/run'

// Called by the Supabase Cron job every 15 minutes.
export const maxDuration = 60

export async function POST(request: Request) {
  if (!isNewsCronRequest(request)) {
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
