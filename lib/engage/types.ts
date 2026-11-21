// ENGAGE lifecycle + message types. Mirrors the user_lifecycle and
// engagement_messages tables (migration 20261121120000_add_engage_lifecycle).

export type LifecycleState = 'unactivated' | 'active' | 'passive' | 'at_risk' | 'dormant'

export const LIFECYCLE_STATES: readonly LifecycleState[] = [
  'unactivated',
  'active',
  'passive',
  'at_risk',
  'dormant',
]

export const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  unactivated: 'Unactivated',
  active: 'Active',
  passive: 'Passive',
  at_risk: 'At Risk',
  dormant: 'Dormant',
}

export type MessageSurface = 'push' | 'popup' | 'topper' | 'email'
export type MessageStatus = 'draft' | 'review' | 'live' | 'paused'

export type EngagementMessage = {
  key: string
  v1_number: number | null
  value_pillar: 'productivity' | 'inspiration' | 'learning' | 'community' | 'reachability'
  message_family: string
  surface: MessageSurface
  lifecycle_states: LifecycleState[]
  priority: number
  title: string
  body: string
  cta_label: string
  cta_path: string
  eligibility: string
  hypothesis: string | null
  success_event: string | null
  status: MessageStatus
  updated_at: string
}

export const MESSAGE_COLUMNS =
  'key, v1_number, value_pillar, message_family, surface, lifecycle_states, priority, title, body, cta_label, cta_path, eligibility, hypothesis, success_event, status, updated_at'

export type UserLifecycle = {
  user_id: string
  lifecycle_state: LifecycleState
  previous_state: LifecycleState | null
  state_entered_at: string
  reactivated_until: string | null
  activated_at: string | null
  last_visit_at: string | null
  previous_visit_at: string | null
  last_core_progress_at: string | null
  visits_7d: number
  core_progress_actions_7d: number
  active_unit_count: number
  stale_active_unit_count: number
  focus_unit_id: string | null
  focus_unit_last_activity_at: string | null
  draft_guide_count: number
  assigned_guide_count: number
  saved_guides_unassigned_count: number
  latest_unassigned_saved_recipe_id: string | null
  deadline_within_72h: boolean
  deadline_unit_id: string | null
  scheduled_session_within_24h: boolean
  recent_social_reward_count: number
  social_reward_recipe_id: string | null
  upcoming_event_24h: boolean
  active_session_unit_id: string | null
  last_session_ended_at: string | null
  last_session_unit_id: string | null
  push_preference: 'on' | 'off' | 'unknown'
  push_platform_permission: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown'
  push_subscription_active: boolean
  notification_soft_opt_in: 'not_shown' | 'shown' | 'enabled' | 'skipped' | 'dismissed'
  notification_opt_in_cooldown_until: string | null
  email_status: 'deliverable' | 'unsubscribed' | 'bounced' | 'unknown'
  email_marketing_allowed: boolean
  last_push_at: string | null
  last_popup_at: string | null
  last_topper_dismissed_at: string | null
  message_family_last_at: Record<string, string>
  message_family_suppressed_until: Record<string, string>
  computed_at: string
}

/** The personal objects a message can refer to, resolved to names. */
export type MessageContext = {
  unitId?: string | null
  unitName?: string | null
  recipeId?: string | null
  guideName?: string | null
}

/** A message ready to render: copy filled in, link resolved. */
export type RenderedMessage = {
  key: string
  surface: MessageSurface
  family: string
  title: string
  body: string
  ctaLabel: string
  ctaPath: string
  targetId: string | null
  isPreview: boolean
}

export type NotificationEventType =
  | 'soft_prompt_shown'
  | 'soft_prompt_enable'
  | 'soft_prompt_skipped'
  | 'soft_prompt_dismissed'
  | 'native_prompt_requested'
  | 'permission_granted'
  | 'permission_denied'
  | 'subscription_removed'
  | 'permission_observed'
