export type AchievementTier = 'red' | 'silver' | 'gold' | 'prismatic'

export type AchievementDefinition = {
  achievement_id: string
  code: string
  name: string
  description: string
  curator_text: string | null
  tier: AchievementTier
  trigger_key: string
  threshold: number | null
  rule_config: Record<string, unknown> | null
  is_hidden: boolean
  is_active: boolean
  sort_order: number | null
  seal_key: string | null
  seal_image_path: string | null
}

export type UserAchievementRow = {
  user_achievement_id: string
  user_id: string
  achievement_id: string
  earned_at: string
  source_type: string | null
  source_id: string | null
  award_metadata: Record<string, unknown> | null
  seen_at: string | null
  created_at: string
}

export type AchievementDisplay = {
  achievementId: string
  code: string
  name: string
  description: string
  curatorText: string | null
  tier: AchievementTier
  triggerKey: string
  sealImagePath: string | null
  sealImageUrl: string | null
  earned: boolean
  earnedAt: string | null
  seenAt: string | null
  currentValue: number | null
  threshold: number | null
  progressPercent: number | null
  progressLabel: string | null
  isHidden: boolean
  isMysteryLocked: boolean
  sortOrder: number
}

export type AchievementCollection = {
  achievements: AchievementDisplay[]
  latestAchievement: AchievementDisplay | null
  unseenAchievements: AchievementDisplay[]
  earnedCount: number
  totalVisibleCount: number
  tierSummary: Record<AchievementTier, { earned: number; total: number }>
  unsupportedTriggers: string[]
  evaluationError: string | null
}

export type AchievementEvaluationOptions = {
  triggers?: string[]
  sourceType?: string
  sourceId?: string | null
}
