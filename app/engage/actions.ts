'use server'

import { createClient } from '../../utils/supabase/server'
import { isCurrentUserAdmin } from '../../lib/admin'
import { eligibleTarget, pickInAppCandidate, renderMessage, type DeviceInfo } from '../../lib/engage/candidates'
import { loadMessages, resolveContext } from '../../lib/engage/server'
import type {
  NotificationEventType,
  RenderedMessage,
  UserLifecycle,
} from '../../lib/engage/types'

const NOTIFICATION_EVENTS: readonly NotificationEventType[] = [
  'soft_prompt_shown',
  'soft_prompt_enable',
  'soft_prompt_skipped',
  'soft_prompt_dismissed',
  'native_prompt_requested',
  'permission_granted',
  'permission_denied',
  'subscription_removed',
  'permission_observed',
]

/**
 * Records this app open and returns the one in-app message to show, if any.
 * Only 'live' messages are chosen for real. An admin can pass previewKey to
 * see any message (live or in review) rendered with their own data.
 */
export async function recordVisitAndGetPrompt(
  device: DeviceInfo,
  previewKey?: string | null
): Promise<RenderedMessage | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: lifecycle, error } = await supabase.rpc('engage_record_visit')
  if (error || !lifecycle) {
    if (error) console.error('[engage] record visit failed', error.message)
    return null
  }

  const row = lifecycle as UserLifecycle
  const messages = await loadMessages(supabase)
  const now = Date.now()

  if (previewKey) {
    if (!(await isCurrentUserAdmin(user.id))) return null
    const message = messages.find((candidate) => candidate.key === previewKey)
    if (!message || (message.surface !== 'popup' && message.surface !== 'topper')) return null
    // Use the admin's real target when they qualify; otherwise their focus
    // unit / latest saved guide, so the copy still reads naturally.
    const target =
      eligibleTarget(message, row, now)?.targetId ??
      (message.cta_path.includes('{recipe_id}')
        ? row.latest_unassigned_saved_recipe_id
        : row.focus_unit_id ?? row.last_session_unit_id)
    const context = await resolveContext(supabase, message, target)
    return renderMessage(message, target, context, true)
  }

  const candidate = pickInAppCandidate(messages, row, device, now)
  if (!candidate) return null
  const context = await resolveContext(supabase, candidate.message, candidate.targetId)
  return renderMessage(candidate.message, candidate.targetId, context, false)
}

export async function recordEngagementDelivery(
  messageKey: string,
  status: 'shown' | 'clicked' | 'dismissed',
  targetId: string | null,
  isPreview: boolean
) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('engage_record_delivery', {
    p_message_key: messageKey,
    p_status: status,
    p_target_id: targetId,
    p_is_preview: isPreview,
  })
  if (error) console.error('[engage] record delivery failed', error.message)
}

export async function recordNotificationEvent(
  eventType: NotificationEventType,
  source: string,
  permission?: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown' | null
) {
  if (!NOTIFICATION_EVENTS.includes(eventType)) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.rpc('engage_record_notification_event', {
    p_event_type: eventType,
    p_source: source.slice(0, 60) || 'unknown',
    p_permission: permission ?? null,
  })
  if (error) console.error('[engage] record notification event failed', error.message)
}
