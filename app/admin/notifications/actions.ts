'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import {
  isPushConfigured,
  sendPushToEveryone,
  sendPushToUser,
  type PushPayload,
} from '../../../lib/push/send'

export type BroadcastInput = {
  title: string
  body: string
  url: string
}

export type BroadcastResult =
  | { ok: true; devices: number; sent: number; failed: number; removed: number }
  | { ok: false; error: string }

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !(await isCurrentUserAdmin(user.id))) return null
  return user
}

function validate(input: BroadcastInput): PushPayload | string {
  const title = input.title?.trim() ?? ''
  const body = input.body?.trim() ?? ''
  const url = input.url?.trim() || '/dashboard'

  if (!title) return 'Add a title.'
  if (title.length > 80) return 'Keep the title under 80 characters.'
  if (!body) return 'Add a message.'
  if (body.length > 300) return 'Keep the message under 300 characters.'
  if (!url.startsWith('/') || url.startsWith('//')) {
    return 'The link must be a page on this site, starting with /.'
  }

  return { title, body, url }
}

/** Sends the draft only to the admin's own devices, to check how it looks. */
export async function sendBroadcastPreview(
  input: BroadcastInput
): Promise<BroadcastResult> {
  const user = await requireAdmin()
  if (!user) return { ok: false, error: 'Not allowed.' }
  if (!isPushConfigured()) return { ok: false, error: 'Push is not configured on the server.' }

  const payload = validate(input)
  if (typeof payload === 'string') return { ok: false, error: payload }

  const result = await sendPushToUser(user.id, payload)
  if (result.sent === 0) {
    return {
      ok: false,
      error: 'None of your devices received it. Turn notifications on in Settings first.',
    }
  }
  return { ok: true, devices: result.sent + result.failed + result.removed, ...result }
}

export async function sendBroadcast(
  input: BroadcastInput
): Promise<BroadcastResult> {
  const user = await requireAdmin()
  if (!user) return { ok: false, error: 'Not allowed.' }
  if (!isPushConfigured()) return { ok: false, error: 'Push is not configured on the server.' }

  const payload = validate(input)
  if (typeof payload === 'string') return { ok: false, error: payload }

  const result = await sendPushToEveryone({ ...payload, tag: 'broadcast' })

  const { error } = await createServiceRoleClient()
    .from('push_broadcasts')
    .insert({
      sent_by: user.id,
      title: payload.title,
      body: payload.body,
      url: payload.url,
      devices: result.devices,
      sent: result.sent,
      failed: result.failed,
      removed: result.removed,
    })

  if (error) console.error('[push] could not log broadcast', error.message)

  revalidatePath('/admin/notifications')
  return { ok: true, ...result }
}
