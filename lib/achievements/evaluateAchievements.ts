import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { calculateAchievementMetrics, getSessionDerivedMetrics } from './achievementMetrics'
import { awardAchievements } from './awardAchievement'
import type {
  AchievementDefinition,
  AchievementDisplay,
  AchievementEvaluationOptions,
  UserAchievementRow,
} from './types'

const TIER_ORDER = ['red', 'silver', 'gold', 'prismatic'] as const
const LOCKED_ACHIEVEMENT_SEAL_PATH = 'achievement_seals/locked_achievement.png'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getThreshold(achievement: AchievementDefinition) {
  return typeof achievement.threshold === 'number'
    ? achievement.threshold
    : achievement.threshold
      ? Number(achievement.threshold)
      : null
}

function getWindowDays(ruleConfig: Record<string, unknown> | null) {
  const raw = ruleConfig?.window_days ?? ruleConfig?.windowDays
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7
}

function evaluateDefinition(
  achievement: AchievementDefinition,
  metricSnapshot: Awaited<ReturnType<typeof calculateAchievementMetrics>>
) {
  const threshold = getThreshold(achievement)
  if (threshold === null) {
    return { qualifies: false, currentValue: null }
  }

  if (achievement.trigger_key === 'painting_days_in_window') {
    const sessionMetrics = getSessionDerivedMetrics(metricSnapshot.sessions)
    const currentValue = sessionMetrics.paintingDaysInWindow(
      getWindowDays(achievement.rule_config)
    )
    return { qualifies: currentValue >= threshold, currentValue }
  }

  if (metricSnapshot.unsupportedTriggers.has(achievement.trigger_key)) {
    console.warn(
      `[achievements] Unsupported trigger_key: ${achievement.trigger_key}`
    )
    return { qualifies: false, currentValue: null }
  }

  const currentValue = metricSnapshot.metrics[achievement.trigger_key]
  if (typeof currentValue !== 'number') {
    console.warn(
      `[achievements] Unknown trigger_key: ${achievement.trigger_key}`
    )
    return { qualifies: false, currentValue: null }
  }

  return { qualifies: currentValue >= threshold, currentValue }
}

function formatProgressLabel(
  triggerKey: string,
  currentValue: number | null,
  threshold: number | null
) {
  if (currentValue === null || threshold === null) return null

  if (triggerKey === 'painting_minutes_total') {
    const currentHours = Math.floor(currentValue / 60)
    const thresholdHours = Math.floor(threshold / 60)
    return `${currentHours}h / ${thresholdHours}h`
  }

  if (triggerKey.includes('paint')) {
    return `${Math.min(currentValue, threshold)} / ${threshold} paints`
  }

  if (triggerKey.includes('models')) {
    return `${Math.min(currentValue, threshold)} / ${threshold} models`
  }

  if (triggerKey.includes('sessions')) {
    return `${Math.min(currentValue, threshold)} / ${threshold} sessions`
  }

  if (triggerKey.includes('days') || triggerKey.includes('streak')) {
    return `${Math.min(currentValue, threshold)} / ${threshold} days`
  }

  return `${Math.min(currentValue, threshold)} / ${threshold}`
}

function getSealImageUrl(
  supabase: SupabaseClient,
  sealImagePath: string | null
) {
  if (!sealImagePath) return null
  return supabase.storage.from('obsidian-images').getPublicUrl(sealImagePath).data
    .publicUrl
}

function toDisplayModel({
  achievement,
  earned,
  metricSnapshot,
  supabase,
}: {
  achievement: AchievementDefinition
  earned: UserAchievementRow | null
  metricSnapshot: Awaited<ReturnType<typeof calculateAchievementMetrics>>
  supabase: SupabaseClient
}): AchievementDisplay {
  const threshold = getThreshold(achievement)
  const evaluation = evaluateDefinition(achievement, metricSnapshot)
  const shouldHideIdentity = achievement.is_hidden && !earned
  const isMysteryLocked =
    !earned && (shouldHideIdentity || achievement.tier !== 'red')
  const shouldHideName =
    !earned && (shouldHideIdentity || achievement.tier === 'prismatic')
  const shouldHideDescription =
    !earned &&
    (shouldHideIdentity ||
      achievement.tier === 'gold' ||
      achievement.tier === 'prismatic')
  const currentValue = earned ? threshold : evaluation.currentValue
  const progressPercent =
    currentValue !== null && threshold
      ? Math.min(100, Math.max(0, (currentValue / threshold) * 100))
      : null

  return {
    achievementId: achievement.achievement_id,
    code: shouldHideIdentity ? `hidden-${achievement.achievement_id}` : achievement.code,
    name: shouldHideName ? 'Locked Achievement' : achievement.name,
    description: shouldHideDescription
      ? 'Description locked.'
      : achievement.description,
    curatorText: earned ? achievement.curator_text : null,
    tier: achievement.tier,
    triggerKey: isMysteryLocked ? 'locked' : achievement.trigger_key,
    sealImagePath: isMysteryLocked
      ? LOCKED_ACHIEVEMENT_SEAL_PATH
      : shouldHideIdentity
        ? null
        : achievement.seal_image_path,
    sealImageUrl: isMysteryLocked
      ? getSealImageUrl(supabase, LOCKED_ACHIEVEMENT_SEAL_PATH)
      : shouldHideIdentity
        ? null
        : getSealImageUrl(supabase, achievement.seal_image_path),
    earned: Boolean(earned),
    earnedAt: earned?.earned_at ?? null,
    seenAt: earned?.seen_at ?? null,
    currentValue,
    threshold,
    progressPercent,
    progressLabel: isMysteryLocked || shouldHideIdentity
      ? null
      : formatProgressLabel(achievement.trigger_key, currentValue, threshold),
    isHidden: achievement.is_hidden,
    isMysteryLocked,
    sortOrder: achievement.sort_order ?? 0,
  }
}

export async function evaluateAchievements(
  userId: string,
  options: AchievementEvaluationOptions = {}
) {
  const service = createServiceRoleClient()
  const { data: definitionsData, error: definitionsError } = await service
    .from('achievements')
    .select(
      'achievement_id, code, name, description, curator_text, tier, trigger_key, threshold, rule_config, is_hidden, is_active, sort_order, seal_key, seal_image_path'
    )
    .eq('is_active', true)
    .order('tier')
    .order('sort_order', { ascending: true })

  if (definitionsError) {
    throw definitionsError
  }

  const definitions = ((definitionsData ?? []) as AchievementDefinition[]).map(
    (achievement) => ({
      ...achievement,
      rule_config: isRecord(achievement.rule_config)
        ? achievement.rule_config
        : null,
    })
  )

  const { data: earnedData, error: earnedError } = await service
    .from('user_achievements')
    .select(
      'user_achievement_id, user_id, achievement_id, earned_at, source_type, source_id, award_metadata, seen_at, created_at'
    )
    .eq('user_id', userId)

  if (earnedError) {
    throw earnedError
  }

  const earnedRows = (earnedData ?? []) as UserAchievementRow[]
  const earnedByAchievementId = new Map(
    earnedRows.map((row) => [row.achievement_id, row])
  )
  const metricSnapshot = await calculateAchievementMetrics(service, userId)
  const triggerFilter = options.triggers?.length
    ? new Set(options.triggers)
    : null

  const newlyQualified = definitions.filter((achievement) => {
    if (earnedByAchievementId.has(achievement.achievement_id)) return false
    if (triggerFilter && !triggerFilter.has(achievement.trigger_key)) return false
    return evaluateDefinition(achievement, metricSnapshot).qualifies
  })

  const inserted = await awardAchievements({
    userId,
    achievements: newlyQualified,
    sourceType: options.sourceType,
    sourceId: options.sourceId,
  })

  const insertedIds = new Set(inserted.map((achievement) => achievement.achievement_id))
  const refreshedEarnedRows = [
    ...earnedRows,
    ...inserted.map((achievement) => ({
      user_achievement_id: '',
      user_id: userId,
      achievement_id: achievement.achievement_id,
      earned_at: new Date().toISOString(),
      source_type: options.sourceType ?? 'achievement_evaluation',
      source_id: options.sourceId ?? null,
      award_metadata: null,
      seen_at: null,
      created_at: new Date().toISOString(),
    })),
  ]
  const refreshedEarnedByAchievementId = new Map(
    refreshedEarnedRows.map((row) => [row.achievement_id, row])
  )

  const achievements = definitions
    .sort((first, second) => {
      const tierDelta =
        TIER_ORDER.indexOf(first.tier) - TIER_ORDER.indexOf(second.tier)
      return tierDelta || (first.sort_order ?? 0) - (second.sort_order ?? 0)
    })
    .map((achievement) =>
      toDisplayModel({
        achievement,
        earned: refreshedEarnedByAchievementId.get(achievement.achievement_id) ?? null,
        metricSnapshot,
        supabase: service,
      })
    )

  const latestAchievement =
    [...achievements]
      .filter((achievement) => achievement.earned && achievement.earnedAt)
      .sort(
        (first, second) =>
          new Date(second.earnedAt ?? 0).getTime() -
          new Date(first.earnedAt ?? 0).getTime()
      )[0] ?? null

  const unseenAchievements = achievements
    .filter(
      (achievement) =>
        achievement.earned &&
        !achievement.seenAt &&
        (insertedIds.has(achievement.achievementId) ||
          refreshedEarnedByAchievementId.get(achievement.achievementId)?.seen_at === null)
    )
    .sort((first, second) => {
      const tierDelta =
        TIER_ORDER.indexOf(second.tier) - TIER_ORDER.indexOf(first.tier)
      return (
        tierDelta ||
        new Date(second.earnedAt ?? 0).getTime() -
          new Date(first.earnedAt ?? 0).getTime()
      )
    })

  const tierSummary = TIER_ORDER.reduce(
    (summary, tier) => {
      const tierAchievements = achievements.filter(
        (achievement) => achievement.tier === tier && !achievement.isHidden
      )
      summary[tier] = {
        earned: achievements.filter(
          (achievement) => achievement.tier === tier && achievement.earned
        ).length,
        total: tierAchievements.length,
      }
      return summary
    },
    {} as Record<(typeof TIER_ORDER)[number], { earned: number; total: number }>
  )

  return {
    achievements,
    latestAchievement,
    unseenAchievements,
    earnedCount: achievements.filter((achievement) => achievement.earned).length,
    totalVisibleCount: achievements.filter((achievement) => !achievement.isHidden).length,
    tierSummary,
    unsupportedTriggers: Array.from(metricSnapshot.unsupportedTriggers),
    evaluationError: null,
  }
}

export async function safeEvaluateAchievements(
  userId: string,
  options: AchievementEvaluationOptions = {}
) {
  try {
    return await evaluateAchievements(userId, options)
  } catch (error) {
    console.error('[achievements] Evaluation failed', error)
    return null
  }
}
