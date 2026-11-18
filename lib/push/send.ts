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

type SubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

const SEND_CONCURRENCY = 20
const PAGE_SIZE = 1000

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
 * Sends one payload to the given subscriptions, a few at a time, deletes the
 * ones the push service reports as gone (404/410) and stamps last_used_at on
 * the ones that worked.
 */
async function sendToSubscriptions(
  subscriptions: SubscriptionRow[],
  payload: PushPayload
): Promise<PushSendResult> {
  configure()

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/dashboard',
    tag: payload.tag,
  })

  const result: PushSendResult = { sent: 0, removed: 0, failed: 0 }
  const goneIds: string[] = []
  const usedIds: string[] = []

  for (let start = 0; start < subscriptions.length; start += SEND_CONCURRENCY) {
    const batch = subscriptions.slice(start, start + SEND_CONCURRENCY)
    await Promise.all(
      batch.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
            // 'high' makes FCM/APNs wake an idle phone. With 'normal',
            // Android Doze and Samsung battery saving held messages back
            // indefinitely (seen on a Samsung, 2026-11-18).
            { TTL: 60 * 60 * 24, urgency: 'high' }
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
  }

  const supabase = createServiceRoleClient()

  for (let start = 0; start < goneIds.length; start += PAGE_SIZE) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', goneIds.slice(start, start + PAGE_SIZE))
  }

  const now = new Date().toISOString()
  for (let start = 0; start < usedIds.length; start += PAGE_SIZE) {
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: now })
      .in('id', usedIds.slice(start, start + PAGE_SIZE))
  }

  return result
}

/** Sends one notification to every device the user has enabled push on. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushSendResult> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return sendToSubscriptions(data ?? [], payload)
}

async function loadAllSubscriptions() {
  const supabase = createServiceRoleClient()
  const rows: (SubscriptionRow & { user_id: string })[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

/** How many devices and distinct people a broadcast would reach right now. */
export async function getPushAudience() {
  const rows = await loadAllSubscriptions()
  return {
    devices: rows.length,
    people: new Set(rows.map((row) => row.user_id)).size,
  }
}

/** Sends one notification to every subscribed device of every user. */
export async function sendPushToEveryone(payload: PushPayload) {
  const rows = await loadAllSubscriptions()
  const result = await sendToSubscriptions(rows, payload)
  return { devices: rows.length, ...result }
}
