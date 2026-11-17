import 'server-only'

import webpush from 'web-push'
import { createServiceRoleClient } from '../../utils/supabase/service-role'

export type PushPayload = {
  title: string
  body: string
  /** Path to open when the notification is tapped. Defaults to /dashboard. */
  url?: string
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string
}

export type PushSendResult = {
  sent: number
  removed: number
  failed: number
}

let configured = false

export function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  )
}

function configure() {
  if (configured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    throw new Error(
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required to send push notifications'
    )
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@obsidiangallery.app',
    publicKey,
    privateKey
  )
  configured = true
}

/**
 * Sends one notification to every device the user has enabled push on.
 * Subscriptions the push service reports as expired are deleted.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  configure()

  const supabase = createServiceRoleClient()
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag,
  })

  const result: PushSendResult = { sent: 0, removed: 0, failed: 0 }
  const goneIds: string[] = []
  const usedIds: string[] = []

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 * 24, urgency: 'normal' }
        )
        result.sent += 1
        usedIds.push(subscription.id)
      } catch (sendError) {
        const statusCode = (sendError as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          goneIds.push(subscription.id)
          result.removed += 1
        } else {
          result.failed += 1
          console.error('[push] send failed', statusCode, sendError)
        }
      }
    })
  )

  if (goneIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', goneIds)
  }

  if (usedIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in('id', usedIds)
  }

  return result
}
