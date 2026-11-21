import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { dispatchPushes } from '../../../../lib/engage/push-dispatch'

// Daily ENGAGE run, called by Vercel Cron (vercel.json) with
// "Authorization: Bearer $CRON_SECRET". Recomputes every user's lifecycle
// row, then sends behavioral pushes — only for messages whose status is
// 'live' in engagement_messages. The proxy lets this path through without a
// session, so the secret check here is the only gate.
export const maxDuration = 60

function secretMatches(provided: string, expected: string) {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  const provided = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || expected.length < 16 || !provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await dispatchPushes({ dryRun: false })
    return NextResponse.json({
      ok: true,
      refreshed: result.refreshed,
      planned: result.planned.length,
      waitingForLive: result.planned.filter((plan) => plan.blockedBy === 'not_live').length,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error('[engage] dispatch failed', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
