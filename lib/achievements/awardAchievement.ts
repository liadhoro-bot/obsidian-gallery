import 'server-only'

import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { captureServerEvent } from '../../utils/analytics/server'
import type { AchievementDefinition } from './types'

export async function awardAchievements({
  userId,
  achievements,
  sourceType = 'achievement_evaluation',
  sourceId = null,
}: {
  userId: string
  achievements: AchievementDefinition[]
  sourceType?: string
  sourceId?: string | null
}) {
  if (!achievements.length) return []

  const service = createServiceRoleClient()
  const earnedAt = new Date().toISOString()
  const rows = achievements.map((achievement) => ({
    user_id: userId,
    achievement_id: achievement.achievement_id,
    earned_at: earnedAt,
    source_type: sourceType,
    source_id: sourceId,
    award_metadata: {
      achievement_code: achievement.code,
      trigger_key: achievement.trigger_key,
    },
  }))

  const { data, error } = await service
    .from('user_achievements')
    .upsert(rows, {
      onConflict: 'user_id,achievement_id',
      ignoreDuplicates: true,
    })
    .select('achievement_id')

  if (error) {
    throw error
  }

  const insertedIds = new Set(
    ((data ?? []) as Array<{ achievement_id: string }>).map(
      (row) => row.achievement_id
    )
  )
  const insertedAchievements = achievements.filter((achievement) =>
    insertedIds.has(achievement.achievement_id)
  )

  await Promise.all(
    insertedAchievements.map((achievement) =>
      captureServerEvent({
        distinctId: userId,
        event: 'achievement_unlocked',
        properties: {
          achievement_code: achievement.code,
          achievement_tier: achievement.tier,
          trigger_key: achievement.trigger_key,
        },
      })
    )
  )

  return insertedAchievements
}
