'use server'

import { createClient } from '../../utils/supabase/server'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { isPushConfigured, sendPushToUser } from '../../lib/push/send'

export type PushActionResult = { error: string | null }

type SerializedSubscription = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function savePushSubscription(
  subscription: SerializedSubscription,
  userAgent: string
): Promise<PushActionResult> {
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth

  if (!endpoint?.startsWith('https://') || !p256dh || !auth) {
    return { error: 'This device returned an invalid push subscription.' }
  }

  const { user } = await getUser()
  if (!user) return { error: 'Please sign in again to turn on notifications.' }

  // A device that was subscribed under another account keeps the same
  // endpoint. RLS would block moving that row, so the verified user's write
  // goes through the service role and the device moves to this account.
  const { error } = await createServiceRoleClient().from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  )

  if (error) return { error: error.message }
  return { error: null }
}

export async function removePushSubscription(
  endpoint: string
): Promise<PushActionResult> {
  const { supabase, user } = await getUser()
  if (!user) return { error: 'Please sign in again.' }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return { error: error.message }
  return { error: null }
}

export async function sendTestPush(): Promise<PushActionResult> {
  const { user } = await getUser()
  if (!user) return { error: 'Please sign in again.' }
  if (!isPushConfigured()) return { error: 'Push is not configured on the server yet.' }

  const result = await sendPushToUser(user.id, {
    title: 'Obsidian Gallery',
    body: 'Notifications are working on this device.',
    url: '/settings',
    tag: 'test',
  })

  if (result.sent === 0) {
    return { error: 'No device received it. Try turning notifications off and on again.' }
  }
  return { error: null }
}
