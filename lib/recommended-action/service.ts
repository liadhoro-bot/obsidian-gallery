import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { captureServerEvent } from '../../utils/analytics/server'
import { reconcileClickedInstance } from './completion'
import { getServedRankingRevision, RULESET_VERSION } from './config'
import { buildUserContext, type UserContext } from './context'
import { evaluateRecommendations } from './engine'
import { evaluateRecommendationsV11 } from './engine-v11'
import { buildSuppression, parseRecommendationKey, type StoredInstance } from './feedback'
import { loadEngineSnapshot } from './snapshot'
import type { EngineResult, EngineSnapshot, RankingRevision, RecommendedActionDTO } from './types'

// One trace row per user, revision and half hour (unique in the table).
const TRACE_BUCKET_MS = 30 * 60 * 1000

export type DashboardRecommendations =
  | {
      status: 'ok'
      recommendations: RecommendedActionDTO[]
      // False until the recommended_action_* tables exist: the card still
      // renders, but feedback is not remembered.
      storageReady: boolean
    }
  | { status: 'error' }

type InstanceRow = StoredInstance & {
  id: string
  rule_id: string
  target_id: string | null
  context_hash: string
  family: string
  clicked_at: string | null
}

// PostgREST / Postgres codes for "table does not exist" (migration not applied).
function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function loadStoredState(supabase: SupabaseClient, userId: string) {
  const [instancesResult, preferencesResult] = await Promise.all([
    supabase
      .from('recommended_action_instances')
      .select(
        'id, recommendation_key, status, snoozed_until, cooldown_until, ignored_impressions, rule_id, target_id, context_hash, family, clicked_at'
      )
      .eq('user_id', userId)
      // Served rows matter only once ignored (novelty) or cooling down.
      .or('status.in.(clicked,completed,dismissed,snoozed),ignored_impressions.gt.0,cooldown_until.not.is.null')
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase
      .from('recommended_action_preferences')
      .select('family_penalties')
      .eq('user_id', userId)
      .maybeSingle<{ family_penalties: Record<string, unknown> }>(),
  ])

  if (isMissingTable(instancesResult.error) || isMissingTable(preferencesResult.error)) {
    return { storageReady: false, instances: [] as InstanceRow[], familyPenalties: null }
  }

  if (instancesResult.error) throw instancesResult.error
  if (preferencesResult.error) throw preferencesResult.error

  return {
    storageReady: true,
    instances: (instancesResult.data ?? []) as InstanceRow[],
    familyPenalties: preferencesResult.data?.family_penalties ?? null,
  }
}

// Completes or expires clicked instances whose outcome is now visible in the
// snapshot. Mutates the in-memory rows so this load already respects it.
async function reconcileClicks(
  supabase: SupabaseClient,
  userId: string,
  snapshot: EngineSnapshot,
  instances: InstanceRow[]
) {
  const writes: PromiseLike<unknown>[] = []

  for (const instance of instances) {
    if (instance.status !== 'clicked' || !instance.clicked_at) continue

    const parsed = parseRecommendationKey(instance.recommendation_key)
    if (!parsed) continue

    const verdict = reconcileClickedInstance(
      { ...parsed, clickedAt: instance.clicked_at },
      snapshot
    )
    if (verdict === 'pending') continue

    instance.status = verdict
    const now = snapshot.now

    writes.push(
      supabase
        .from('recommended_action_instances')
        .update({
          status: verdict,
          ...(verdict === 'completed' ? { completed_at: now } : {}),
          updated_at: now,
        })
        .eq('id', instance.id)
        .eq('status', 'clicked'),
      supabase.from('recommended_action_events').upsert(
        {
          user_id: userId,
          instance_id: instance.id,
          recommendation_key: instance.recommendation_key,
          event_type: verdict === 'completed' ? 'goal_completed' : verdict,
          dedup_key: `${verdict}:${instance.id}`,
          metadata: { rule_id: parsed.ruleId, family: instance.family, ruleset_version: RULESET_VERSION },
        },
        { onConflict: 'user_id,dedup_key', ignoreDuplicates: true }
      )
    )

    if (verdict === 'completed') {
      writes.push(
        captureServerEvent({
          distinctId: userId,
          event: 'ra_goal_completed',
          properties: {
            recommendation_id: instance.id,
            rule_id: parsed.ruleId,
            feature_family: instance.family,
            ruleset_version: RULESET_VERSION,
            elapsed_ms: Date.parse(now) - Date.parse(instance.clicked_at),
          },
        })
      )
    }
  }

  // Bookkeeping only: a failed write is retried on the next load.
  await Promise.allSettled(writes)
}

function coverageLabel(snapshot: EngineSnapshot) {
  if (!snapshot.activity) return 'entities_only'
  const coverage = snapshot.coverage
  return coverage && (coverage.unitsTruncated || coverage.projectsTruncated || coverage.guidesTruncated)
    ? 'truncated'
    : 'complete'
}

// Served and shadow ranking side by side, ids and numbers only. Bookkeeping:
// a failed or duplicate write never affects the card.
async function writeTraces(
  supabase: SupabaseClient,
  userId: string,
  snapshot: EngineSnapshot,
  context: UserContext,
  results: Record<RankingRevision, EngineResult>,
  served: RankingRevision,
  now: Date
) {
  const bucket = Math.floor(now.getTime() / TRACE_BUCKET_MS)
  const agreement =
    results.v1.diagnostics.trace?.winner?.recommendationKey ===
    results['v1.1'].diagnostics.trace?.winner?.recommendationKey

  const rows = (Object.keys(results) as RankingRevision[]).map((revision) => {
    const { diagnostics } = results[revision]
    const trace = diagnostics.trace

    return {
      user_id: userId,
      time_bucket: bucket,
      ranking_revision: revision,
      served: revision === served,
      ruleset_version: diagnostics.rulesetVersion,
      lifecycle: context.lifecycle,
      observed_intent: context.intent,
      data_confidence: context.confidence,
      snapshot_coverage: coverageLabel(snapshot),
      winner: trace?.winner ?? null,
      alternatives: trace?.alternatives ?? [],
      rejections: { counts: trace?.rejections ?? {}, sample: trace?.rejected ?? [] },
      context: {
        persona: context.persona,
        reasons: context.reasons,
        family_evidence: context.familyEvidence,
        familiarity: context.familiarity,
      },
      shadow_agreement: agreement,
    }
  })

  const { error } = await supabase
    .from('recommended_action_traces')
    .upsert(rows, { onConflict: 'user_id,ranking_revision,time_bucket', ignoreDuplicates: true })

  if (error && !isMissingTable(error)) {
    console.error('[recommended-action] trace write failed', error.message)
  }
}

// A failed evaluation is an engineering fault, logged as such (never as the
// user ignoring anything). At most one row per user per half hour.
async function recordEvaluationFault(supabase: SupabaseClient, userId: string, now: Date, error: unknown) {
  const bucket = Math.floor(now.getTime() / TRACE_BUCKET_MS)
  const sources =
    error && typeof error === 'object' && 'sources' in error ? (error as { sources: string[] }).sources : []

  await Promise.allSettled([
    supabase.from('recommended_action_events').upsert(
      {
        user_id: userId,
        recommendation_key: 'evaluation:fault',
        event_type: 'evaluation_fault',
        dedup_key: `evaluation_fault:${bucket}`,
        metadata: { sources, ruleset_version: RULESET_VERSION },
      },
      { onConflict: 'user_id,dedup_key', ignoreDuplicates: true }
    ),
    captureServerEvent({
      distinctId: userId,
      event: 'ra_evaluation_fault',
      properties: { sources, ruleset_version: RULESET_VERSION },
    }),
  ])
}

export async function getDashboardRecommendations(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<DashboardRecommendations> {
  try {
    const [snapshot, stored] = await Promise.all([
      loadEngineSnapshot(supabase, userId, now),
      loadStoredState(supabase, userId),
    ])

    if (stored.storageReady) {
      await reconcileClicks(supabase, userId, snapshot, stored.instances)
    }

    const suppression = buildSuppression(stored.instances, stored.familyPenalties, now.getTime())
    const context = buildUserContext(snapshot)
    const served = getServedRankingRevision()
    // Shadow mode: both revisions rank the same snapshot; only one is shown.
    const results: Record<RankingRevision, EngineResult> = {
      v1: evaluateRecommendations(snapshot, suppression, { context }),
      'v1.1': evaluateRecommendationsV11(snapshot, suppression, { context }),
    }

    if (stored.storageReady) {
      await writeTraces(supabase, userId, snapshot, context, results, served, now)
    }

    return { status: 'ok', recommendations: results[served].recommendations, storageReady: stored.storageReady }
  } catch (error) {
    console.error('[recommended-action] failed to load recommendations', error)
    await recordEvaluationFault(supabase, userId, now, error)
    return { status: 'error' }
  }
}
