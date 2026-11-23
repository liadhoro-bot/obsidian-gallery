import { NextResponse } from 'next/server'
import { getInboxItems } from '../../../community/newsroom/inbox-queries'
import { isNewsCronRequest } from '../../../../lib/news/cron-auth'
import { isPushConfigured, sendPushToUser } from '../../../../lib/push/send'

// Called by Supabase Cron once a morning: tells the editors (ADMIN_USER_IDS)
// how many stories are in today's digest. Nothing is sent on a quiet day.
export const maxDuration = 30

function editorIds() {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function POST(request: Request) {
  if (!isNewsCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { items, failed } = await getInboxItems('today')
  if (failed) return NextResponse.json({ ok: false }, { status: 500 })
  if (items.length === 0) return NextResponse.json({ ok: true, stories: 0, sent: 0 })
  if (!isPushConfigured()) return NextResponse.json({ ok: true, stories: items.length, sent: 0 })

  const payload = {
    title: `News digest: ${items.length} ${items.length === 1 ? 'story' : 'stories'} today`,
    body: items
      .slice(0, 2)
      .map((item) => item.title)
      .join(' · ')
      .slice(0, 180),
    url: '/community/newsroom/inbox',
    tag: 'news-digest',
  }

  let sent = 0
  for (const userId of editorIds()) {
    try {
      sent += (await sendPushToUser(userId, payload)).sent
    } catch (error) {
      console.error('News digest push failed', error)
    }
  }
  return NextResponse.json({ ok: true, stories: items.length, sent })
}
