import 'server-only'

import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { isPushConfigured, sendPushToUser } from '../push/send'
import { eligibleTarget, pushCadenceAllows, renderMessage } from './candidates'
import { loadMessages, resolveContext } from './server'
import type { EngagementMessage, LifecycleState, RenderedMessage, UserLifecycle } from './types'

// Behavioral push (framework 8.2 "personal progress loop" and V1 #1, #2, #7).
// Runs once a day from the cron route: recompute every lifecycle row, pick at
// most one push per user (priority order), check cadence, and send only
// messages whose status is 'live'. A dry run returns the same plan without
// sending, which is what the admin page shows while messages are in review.

export type PlannedPush = {
  userId: string
  lifecycleState: LifecycleState
  messageKey: string
  rendered: RenderedMessage
  blockedBy: 'not_live' | null
}

export type DispatchResult = {
  refreshed: number
  planned: PlannedPush[]
  sent: number
  failed: number
}

const PAGE = 1000

async function loadLifecycles() {
  const supabase = createServiceRoleClient()
  const rows: UserLifecycle[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('user_lifecycle')
      .select('*')
      .order('user_id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as UserLifecycle[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

async function loadRecentPushTimes(sinceMs: number) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('engagement_deliveries')
    .select('user_id, created_at')
    .eq('channel', 'push')
    .eq('status', 'sent')
    .eq('is_preview', false)
    .gte('created_at', new Date(sinceMs).toISOString())
  if (error) throw new Error(error.message)
  const byUser = new Map<string, number[]>()
  for (const row of data ?? []) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), Date.parse(row.created_at)])
  }
  return byUser
}

export async function planPushes(now = Date.now(), { refresh = true } = {}) {
  const supabase = createServiceRoleClient()
  let refreshed = 0
  if (refresh) {
    const { data, error } = await supabase.rpc('engage_refresh_all')
    if (error) throw new Error(error.message)
    refreshed = Number(data) || 0
  }

  const [messages, lifecycles, recent] = await Promise.all([
    loadMessages(supabase),
    loadLifecycles(),
    loadRecentPushTimes(now - 14 * 24 * 60 * 60 * 1000),
  ])

  const pushMessages = messages
    .filter((message) => message.surface === 'push' && message.status !== 'draft' && message.status !== 'paused')
    .sort((a, b) => a.priority - b.priority || (a.v1_number ?? 99) - (b.v1_number ?? 99))

  const planned: PlannedPush[] = []
  for (const lifecycle of lifecycles) {
    for (const message of pushMessages) {
      const target = eligibleTarget(message, lifecycle, now)
      if (!target) continue
      if (!pushCadenceAllows(lifecycle, recent.get(lifecycle.user_id) ?? [], message.message_family, now)) {
        continue
      }
      const context = await resolveContext(supabase, message, target.targetId)
      planned.push({
        userId: lifecycle.user_id,
        lifecycleState: lifecycle.lifecycle_state,
        messageKey: message.key,
        rendered: renderMessage(message, target.targetId, context, false),
        blockedBy: message.status === 'live' ? null : 'not_live',
      })
      break // one push per user per run
    }
  }

  return { refreshed, planned, messages }
}

async function logPush(
  userId: string,
  message: EngagementMessage | { key: string; message_family: string },
  lifecycleState: LifecycleState | null,
  targetId: string | null,
  ok: boolean,
  isPreview: boolean
) {
  const supabase = createServiceRoleClient()
  const at = new Date()
  await supabase.from('engagement_deliveries').insert({
    user_id: userId,
    message_key: message.key,
    channel: 'push',
    status: ok ? 'sent' : 'failed',
    lifecycle_state: lifecycleState,
    target_id: targetId,
    is_preview: isPreview,
    dedup_key: `${message.key}:${targetId ?? '-'}:push:${at.toISOString()}`,
  })
  if (!ok || isPreview) return

  const { data } = await supabase
    .from('user_lifecycle')
    .select('message_family_last_at')
    .eq('user_id', userId)
    .maybeSingle()
  await supabase
    .from('user_lifecycle')
    .update({
      last_push_at: at.toISOString(),
      message_family_last_at: {
        ...((data?.message_family_last_at as Record<string, string> | undefined) ?? {}),
        [message.message_family]: at.toISOString(),
      },
    })
    .eq('user_id', userId)
}

export async function dispatchPushes({ dryRun }: { dryRun: boolean }): Promise<DispatchResult> {
  const { refreshed, planned, messages } = await planPushes()
  let sent = 0
  let failed = 0

  if (!dryRun && isPushConfigured()) {
    for (const plan of planned) {
      if (plan.blockedBy) continue
      const message = messages.find((candidate) => candidate.key === plan.messageKey)!
      const result = await sendPushToUser(plan.userId, {
        title: plan.rendered.title,
        body: plan.rendered.body,
        url: plan.rendered.ctaPath,
        tag: `engage-${message.message_family}`,
      })
      const ok = result.sent > 0
      if (ok) sent += 1
      else failed += 1
      await logPush(plan.userId, message, plan.lifecycleState, plan.rendered.targetId, ok, false)
    }
  }

  return { refreshed, planned, sent, failed }
}

/**
 * Admin test: sends one push message to the admin's own devices, filled in
 * with their own data. Logged as a preview; cadence is untouched.
 */
export async function sendPushPreviewToSelf(userId: string, messageKey: string) {
  const supabase = createServiceRoleClient()
  const messages = await loadMessages(supabase)
  const message = messages.find((candidate) => candidate.key === messageKey)
  if (!message || message.surface !== 'push') return { ok: false as const, error: 'Not a push message.' }

  const { data: lifecycle } = await supabase.rpc('engage_compute_lifecycle', { p_user_id: userId })
  const row = lifecycle as UserLifecycle | null
  const now = Date.now()
  const targetId =
    (row && eligibleTarget(message, row, now)?.targetId) ??
    (message.cta_path.includes('{recipe_id}')
      ? row?.social_reward_recipe_id ?? row?.latest_unassigned_saved_recipe_id ?? null
      : row?.focus_unit_id ?? null)
  const context = await resolveContext(supabase, message, targetId)
  const rendered = renderMessage(message, targetId, context, true)

  const result = await sendPushToUser(userId, {
    title: rendered.title,
    body: rendered.body,
    url: rendered.ctaPath,
    tag: `engage-preview-${message.key}`,
  })
  await logPush(userId, message, row?.lifecycle_state ?? null, targetId, result.sent > 0, true)
  if (result.sent === 0) return { ok: false as const, error: 'None of your devices received it. Turn notifications on in Settings first.' }
  return { ok: true as const, rendered }
}
