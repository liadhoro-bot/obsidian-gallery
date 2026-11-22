'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { isPushConfigured } from '../../../lib/push/send'
import { planPushes, sendPushPreviewToSelf } from '../../../lib/engage/push-dispatch'
import type { LifecycleState, MessageStatus } from '../../../lib/engage/types'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isCurrentUserAdmin(user.id))) return null
  return user
}

export async function setEngagementMessageStatus(key: string, status: MessageStatus) {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }
  if (!['draft', 'review', 'live', 'paused'].includes(status)) {
    return { ok: false as const, error: 'Unknown status.' }
  }
  const { data: message } = await createServiceRoleClient()
    .from('engagement_messages')
    .select('surface')
    .eq('key', key)
    .maybeSingle()
  if (!message) return { ok: false as const, error: 'Unknown message.' }
  if (status === 'live' && message.surface === 'email') {
    return { ok: false as const, error: 'Email has no sender or marketing consent yet, so it cannot go live.' }
  }

  const { error } = await createServiceRoleClient()
    .from('engagement_messages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/engage')
  return { ok: true as const }
}

export async function sendEngagePushPreview(key: string) {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }
  if (!isPushConfigured()) return { ok: false as const, error: 'Push is not configured on the server.' }
  const result = await sendPushPreviewToSelf(user.id, key)
  revalidatePath('/admin/engage')
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error }
}

const STATES: readonly LifecycleState[] = ['unactivated', 'active', 'passive', 'at_risk', 'dormant']

export async function updateEngagementMessage(
  key: string,
  fields: {
    title: string
    body: string
    cta_label: string
    cta_path: string
    priority: number
    lifecycle_states: LifecycleState[]
  }
) {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }

  const title = fields.title.trim()
  const body = fields.body.trim()
  const ctaLabel = fields.cta_label.trim()
  const ctaPath = fields.cta_path.trim()
  const priority = Math.round(Number(fields.priority))
  const states = [...new Set(fields.lifecycle_states)].filter((state) => STATES.includes(state))

  if (!title || title.length > 120) return { ok: false as const, error: 'The title needs 1–120 characters.' }
  if (!body || body.length > 600) return { ok: false as const, error: 'The body needs 1–600 characters.' }
  if (!ctaLabel || ctaLabel.length > 40) return { ok: false as const, error: 'The button needs 1–40 characters.' }
  if (!ctaPath.startsWith('/') || ctaPath.startsWith('//') || ctaPath.length > 200) {
    return { ok: false as const, error: 'The link must be a path inside the app, starting with /.' }
  }
  if (!(priority >= 1 && priority <= 7)) return { ok: false as const, error: 'Priority is 1 to 7.' }
  if (states.length === 0) return { ok: false as const, error: 'Pick at least one lifecycle state.' }

  const { data, error } = await createServiceRoleClient()
    .from('engagement_messages')
    .update({
      title,
      body,
      cta_label: ctaLabel,
      cta_path: ctaPath,
      priority,
      lifecycle_states: states,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)
    .select('key')
  if (error) return { ok: false as const, error: error.message }
  if (!data?.length) return { ok: false as const, error: 'Unknown message.' }
  revalidatePath('/admin/engage')
  return { ok: true as const }
}

export type DryRunRow = {
  name: string
  state: LifecycleState
  messageKey: string
  title: string
  body: string
  willSend: boolean
}

/** Today's push plan without sending anything: who would get which push. */
export async function dryRunToday() {
  const user = await requireAdmin()
  if (!user) return { ok: false as const, error: 'Not allowed.' }

  const { planned, refreshed } = await planPushes(Date.now(), { refresh: true })
  const service = createServiceRoleClient()
  const { data: profiles } = planned.length
    ? await service
        .from('profiles')
        .select('id, display_name, username, email')
        .in('id', planned.map((plan) => plan.userId))
    : { data: [] }
  const nameOf = new Map(
    (profiles ?? []).map((row) => [row.id, row.display_name || row.username || row.email || row.id.slice(0, 8)])
  )

  const rows: DryRunRow[] = planned.map((plan) => ({
    name: nameOf.get(plan.userId) ?? plan.userId.slice(0, 8),
    state: plan.lifecycleState,
    messageKey: plan.messageKey,
    title: plan.rendered.title,
    body: plan.rendered.body,
    willSend: plan.blockedBy === null,
  }))
  return { ok: true as const, refreshed, rows, at: new Date().toISOString() }
}
