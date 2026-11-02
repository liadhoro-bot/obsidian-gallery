import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { isRecommendedActionEnabledFor } from '../../../../lib/recommended-action/config'
import {
  isFeatureFamily,
  nextImpressionState,
  parseRecommendationKey,
  snoozeUntil,
  withFamilyPenalty,
  type ImpressionState,
} from '../../../../lib/recommended-action/feedback'
import type { FeatureFamily } from '../../../../lib/recommended-action/types'

// Card feedback and tracking: impression, primary click, show another,
// snooze, dismiss. Sent with keepalive so a click survives the navigation it
// triggers. Rule and target come from the key, never from separate fields.

const EVENT_TYPES = [
  'impression',
  'primary_click',
  'show_another',
  'snooze',
  'dismiss',
  // Optional one-tap reason after "Not interested".
  'dismiss_reason',
  // The CTA couldn't be dispatched: an engineering fault, not a preference.
  'action_failed',
] as const
type EventType = (typeof EVENT_TYPES)[number]

const PERSONAS = ['paint_miniature', 'organize_hobby', 'create_content', 'look_around', 'unknown']
const PERSONA_SOURCES = ['explicit', 'inferred', 'default']
const TARGET_TYPES = ['none', 'project', 'unit', 'guide', 'session']
const DISMISS_REASONS = ['not_relevant', 'already_done', 'not_now', 'dont_use_feature'] as const
type DismissReason = (typeof DISMISS_REASONS)[number]
const LIFECYCLES = ['new', 'activated', 'established', 'lapsed']
const INTENTS = ['painting', 'paint_collection', 'guide_creation', 'guide_discovery', 'mixed', 'unknown']
const CONFIDENCES = ['high', 'medium', 'low']
const RANKING_REVISIONS = ['v1', 'v1.1']

type EventBody = {
  type: EventType
  key: string
  family: FeatureFamily
  actionType: string
  targetType: string
  ruleVersion: number
  rulesetVersion: string
  persona: string
  personaSource: string
  visitId: string
  clientTs: string | null
  reason: DismissReason | null
  // Context stamped by the engine; optional so older clients still work.
  lifecycle: string | null
  observedIntent: string | null
  dataConfidence: string | null
  rankingRevision: string | null
}

function readBody(raw: unknown): EventBody | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const text = (value: unknown, max = 64) =>
    typeof value === 'string' && value.length > 0 && value.length <= max ? value : null

  const type = EVENT_TYPES.find((candidate) => candidate === body.type)
  const key = text(body.key, 120)
  const family = text(body.family)
  const actionType = text(body.actionType)
  const targetType = text(body.targetType)
  const rulesetVersion = text(body.rulesetVersion)
  const persona = text(body.persona)
  const personaSource = text(body.personaSource)
  const visitId = text(body.visitId)
  const ruleVersion = Number(body.ruleVersion)

  if (
    !type || !key || !isFeatureFamily(family) || !actionType || !/^[A-Z_]+$/.test(actionType) ||
    !targetType || !TARGET_TYPES.includes(targetType) || !rulesetVersion ||
    !persona || !PERSONAS.includes(persona) || !personaSource || !PERSONA_SOURCES.includes(personaSource) ||
    !visitId || !Number.isInteger(ruleVersion)
  ) {
    return null
  }

  const oneOf = (value: unknown, allowed: readonly string[]) =>
    typeof value === 'string' && allowed.includes(value) ? value : null
  const reason = oneOf(body.reason, DISMISS_REASONS) as DismissReason | null

  if (type === 'dismiss_reason' && !reason) {
    return null
  }

  const clientTs = text(body.clientTs) && !Number.isNaN(Date.parse(body.clientTs as string))
    ? (body.clientTs as string)
    : null

  return {
    type, key, family, actionType, targetType, ruleVersion, rulesetVersion,
    persona, personaSource, visitId, clientTs, reason,
    lifecycle: oneOf(body.lifecycle, LIFECYCLES),
    observedIntent: oneOf(body.observedIntent, INTENTS),
    dataConfidence: oneOf(body.dataConfidence, CONFIDENCES),
    rankingRevision: oneOf(body.rankingRevision, RANKING_REVISIONS),
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  if (!isRecommendedActionEnabledFor(user.id)) {
    return NextResponse.json({ error: 'Not enabled.' }, { status: 404 })
  }

  const body = readBody(await request.json().catch(() => null))
  const parsedKey = body ? parseRecommendationKey(body.key) : null

  if (!body || !parsedKey) {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 })
  }

  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()

  // Create the instance on first contact; later events update it.
  const { error: insertError } = await supabase.from('recommended_action_instances').upsert(
    {
      user_id: user.id,
      recommendation_key: body.key,
      rule_id: parsedKey.ruleId,
      rule_version: body.ruleVersion,
      ruleset_version: body.rulesetVersion,
      family: body.family,
      action_type: body.actionType,
      target_type: body.targetType,
      target_id: parsedKey.targetId,
      context_hash: parsedKey.contextHash,
      persona: body.persona,
      persona_source: body.personaSource,
      ranking_revision: body.rankingRevision,
    },
    { onConflict: 'user_id,recommendation_key', ignoreDuplicates: true }
  )

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: instance, error: instanceError } = await supabase
    .from('recommended_action_instances')
    .select('id, status, first_impression_at, last_impression_at, ignored_impressions, cooldown_until, clicked_at')
    .eq('user_id', user.id)
    .eq('recommendation_key', body.key)
    .single<ImpressionState & { id: string; status: string }>()

  if (instanceError || !instance) {
    return NextResponse.json({ error: instanceError?.message ?? 'Missing instance.' }, { status: 500 })
  }

  let update: Record<string, unknown> | null = null
  // Impressions and show-another collapse to one row per visit; decisions
  // (click, snooze, dismiss) are kept per visit too, so a double tap is one row.
  const dedupKey = `${body.type}:${instance.id}:${body.visitId}`

  switch (body.type) {
    case 'impression': {
      const next = nextImpressionState(instance, nowMs)
      if (next) update = next
      break
    }
    case 'primary_click':
      // A finished instance stays finished; anything else waits for its goal.
      if (instance.status !== 'completed') {
        update = { status: 'clicked', clicked_at: now }
      }
      break
    case 'snooze':
      update = { status: 'snoozed', snoozed_until: snoozeUntil(nowMs) }
      break
    case 'dismiss':
      update = { status: 'dismissed', dismissed_at: now }
      break
    case 'dismiss_reason':
      update = { dismiss_reason: body.reason }
      break
    case 'show_another':
    case 'action_failed':
      break
  }

  const writes: PromiseLike<{ error: { message: string } | null }>[] = [
    supabase.from('recommended_action_events').upsert(
      {
        user_id: user.id,
        instance_id: instance.id,
        recommendation_key: body.key,
        event_type: body.type,
        dedup_key: dedupKey,
        visit_id: body.visitId,
        client_ts: body.clientTs,
        metadata: {
          rule_id: parsedKey.ruleId,
          rule_version: body.ruleVersion,
          ruleset_version: body.rulesetVersion,
          family: body.family,
          action_type: body.actionType,
          target_type: body.targetType,
          persona: body.persona,
          persona_source: body.personaSource,
          ranking_revision: body.rankingRevision,
          lifecycle: body.lifecycle,
          observed_intent: body.observedIntent,
          data_confidence: body.dataConfidence,
          ...(body.reason ? { reason: body.reason } : {}),
        },
      },
      { onConflict: 'user_id,dedup_key', ignoreDuplicates: true }
    ),
  ]

  if (update) {
    writes.push(
      supabase
        .from('recommended_action_instances')
        .update({ ...update, updated_at: now })
        .eq('id', instance.id)
    )
  }

  if (body.type === 'dismiss') {
    const { data: preferences } = await supabase
      .from('recommended_action_preferences')
      .select('family_penalties')
      .eq('user_id', user.id)
      .maybeSingle<{ family_penalties: Record<string, unknown> }>()

    writes.push(
      supabase.from('recommended_action_preferences').upsert(
        {
          user_id: user.id,
          family_penalties: withFamilyPenalty(preferences?.family_penalties, body.family, nowMs),
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
    )
  }

  const results = await Promise.all(writes)
  const failed = results.find((result) => result.error)

  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
