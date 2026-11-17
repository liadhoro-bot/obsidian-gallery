import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { isCurrentUserAdmin } from '../../../../lib/admin'
import { isPushConfigured, sendPushToUser } from '../../../../lib/push/send'

// Admin-only: send a push notification to one user's devices.
// POST { userId, title, body, url?, tag? }
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !(await isCurrentUserAdmin(user.id))) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 })
  }

  const input = (await request.json().catch(() => null)) as {
    userId?: string
    title?: string
    body?: string
    url?: string
    tag?: string
  } | null

  if (!input?.userId || !input.title || !input.body) {
    return NextResponse.json(
      { error: 'userId, title and body are required' },
      { status: 400 }
    )
  }

  if (input.url && !input.url.startsWith('/')) {
    return NextResponse.json({ error: 'url must be a path on this site' }, { status: 400 })
  }

  const result = await sendPushToUser(input.userId, {
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 400),
    url: input.url,
    tag: input.tag,
  })

  return NextResponse.json(result)
}
