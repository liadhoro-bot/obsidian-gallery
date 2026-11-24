import { popupImageOf } from './popup-images'
import type {
  EngagementMessage,
  MessageContext,
  RenderedMessage,
  UserLifecycle,
} from './types'

// Deterministic V1 selection (framework sections 9 and 13): lifecycle state
// picks the objective, context modifiers pick the message, reachability picks
// the channel, cadence and suppression decide whether anything shows at all.
// Pure functions: the server action, the push dispatcher and the admin page
// all call these with rows they loaded.

const DAY = 24 * 60 * 60 * 1000
export const STALE_UNIT_DAYS = 3
export const SESSION_POPUP_WINDOW_MINUTES = 30
export const PUSH_MAX_PER_7_DAYS = 2
/** An unanswered opt-in popup comes back after this long (the topper fills the gap). */
export const OPT_IN_REASK_HOURS = 24

export type DeviceInfo = {
  /** What this device's push permission looks like right now (client-reported). */
  push: 'on' | 'off' | 'denied' | 'unsupported' | 'unknown'
  /** A popup has already been shown in this app session. */
  popupShownThisSession: boolean
  /** The current page (some surfaces stay out of the way on certain pages). */
  pathname: string
}

export type Candidate = {
  message: EngagementMessage
  targetId: string | null
  context: MessageContext
}

function ms(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? parsed : null
}

function isSuppressed(lifecycle: UserLifecycle, family: string, now: number) {
  const until = ms(lifecycle.message_family_suppressed_until?.[family])
  return until !== null && until > now
}

function inOptInCooldown(lifecycle: UserLifecycle, now: number) {
  const until = ms(lifecycle.notification_opt_in_cooldown_until)
  return until !== null && until > now
}

/** Push is off everywhere for this user and the browser would still let us ask. */
function optInAskable(lifecycle: UserLifecycle, now: number) {
  if (lifecycle.push_subscription_active) return false
  if (lifecycle.push_platform_permission === 'denied') return false
  if (lifecycle.push_platform_permission === 'unsupported') return false
  return !inOptInCooldown(lifecycle, now)
}

/** The opt-in was shown within the last day and not answered (peeker closed the app). */
function optInAskedRecently(lifecycle: UserLifecycle, now: number) {
  const last = ms(lifecycle.message_family_last_at?.notification_opt_in)
  return last !== null && now - last < OPT_IN_REASK_HOURS * 60 * 60 * 1000
}

/**
 * Which object a message would talk about for this user, or null when the
 * user doesn't meet the message's eligibility rule. Ignores status, cadence
 * and suppression — see pickInAppCandidate / isPushEligible for those.
 */
export function eligibleTarget(
  message: EngagementMessage,
  lifecycle: UserLifecycle,
  now: number,
  device?: DeviceInfo
): { targetId: string | null } | null {
  if (!message.lifecycle_states.includes(lifecycle.lifecycle_state)) return null

  const focusIdleMs = (() => {
    const last = ms(lifecycle.focus_unit_last_activity_at)
    return last === null ? null : now - last
  })()
  const focusIsStale = focusIdleMs !== null && focusIdleMs >= STALE_UNIT_DAYS * DAY

  switch (message.key) {
    case 'stale_unit_push':
      return lifecycle.focus_unit_id && focusIsStale ? { targetId: lifecycle.focus_unit_id } : null

    case 'at_risk_return_push': {
      const idleFor = now - (ms(lifecycle.last_core_progress_at) ?? now)
      if (!lifecycle.focus_unit_id || idleFor < 7 * DAY) return null
      return { targetId: lifecycle.focus_unit_id }
    }

    case 'dormant_return_push':
      return lifecycle.focus_unit_id ? { targetId: lifecycle.focus_unit_id } : null

    // Not sent automatically: the admin page lists these people so they can
    // be written to personally.
    case 'at_risk_return_email':
      return lifecycle.focus_unit_id &&
        lifecycle.email_marketing_allowed &&
        lifecycle.email_status === 'deliverable' &&
        !lifecycle.push_subscription_active
        ? { targetId: lifecycle.focus_unit_id }
        : null

    case 'session_next_step_popup': {
      const ended = ms(lifecycle.last_session_ended_at)
      if (!lifecycle.last_session_unit_id || ended === null) return null
      if (now - ended > SESSION_POPUP_WINDOW_MINUTES * 60 * 1000) return null
      if (lifecycle.active_session_unit_id) return null
      return { targetId: lifecycle.last_session_unit_id }
    }

    case 'resume_unit_topper':
      if (lifecycle.active_session_unit_id) return null
      return lifecycle.focus_unit_id && focusIsStale ? { targetId: lifecycle.focus_unit_id } : null

    case 'saved_guide_assign_popup':
      return lifecycle.latest_unassigned_saved_recipe_id && lifecycle.active_unit_count > 0
        ? { targetId: lifecycle.latest_unassigned_saved_recipe_id }
        : null

    case 'assigned_guide_session_topper':
      return lifecycle.active_session_unit_id && lifecycle.assigned_guide_count > 0
        ? { targetId: lifecycle.active_session_unit_id }
        : null

    case 'social_reward_push':
      return lifecycle.recent_social_reward_count > 0 && lifecycle.social_reward_recipe_id
        ? { targetId: lifecycle.social_reward_recipe_id }
        : null

    // Push opt-in comes first (it is what lets us reach people later).
    // Popup: Active users get the "keep your bench warm" ask, everyone else
    // coming back gets the "grey pile" ask. Topper: the one-line follow-up
    // when the popup was shown in the last day (or this session) unanswered.
    case 'push_opt_in_popup':
    case 'push_opt_in_return_popup':
    case 'push_opt_in_topper': {
      if (!optInAskable(lifecycle, now)) return null
      // Only where the native prompt can actually appear.
      if (device && device.push !== 'off') return null
      const askedRecently = optInAskedRecently(lifecycle, now) || Boolean(device?.popupShownThisSession)
      if (message.key === 'push_opt_in_topper' ? !askedRecently : askedRecently) return null
      return { targetId: lifecycle.focus_unit_id }
    }

    default:
      return null
  }
}

function fill(template: string, context: MessageContext) {
  return template
    .replaceAll('{unit}', context.unitName?.trim() || 'Your unit')
    .replaceAll('{guide}', context.guideName?.trim() || 'Your Guide')
    .replaceAll('{unit_id}', context.unitId ?? '')
    .replaceAll('{recipe_id}', context.recipeId ?? '')
    .replaceAll('{guide_id}', context.recipeId ?? '')
}

export function renderMessage(
  message: EngagementMessage,
  targetId: string | null,
  context: MessageContext,
  isPreview: boolean
): RenderedMessage {
  const ctaPath = fill(message.cta_path, context)
  return {
    key: message.key,
    surface: message.surface,
    family: message.message_family,
    title: fill(message.title, context),
    body: fill(message.body, context),
    ctaLabel: fill(message.cta_label, context),
    // A template whose id is missing would link nowhere useful.
    ctaPath: /\/(units|recipes)\/(\?|$)|unit=(&|$)/.test(ctaPath) ? '/dashboard' : ctaPath,
    targetId,
    isPreview,
    image: popupImageOf(message),
  }
}

/** Which id kind a message's target is. */
export function targetKind(message: EngagementMessage): 'unit' | 'recipe' {
  return message.cta_path.includes('{recipe_id}') ? 'recipe' : 'unit'
}

/**
 * The one in-app message to show now, or null. Topper and popup compete in
 * priority order; a popup is skipped if one was already shown this session.
 */
export function pickInAppCandidate(
  messages: EngagementMessage[],
  lifecycle: UserLifecycle,
  device: DeviceInfo,
  now: number,
  { includeReview = false }: { includeReview?: boolean } = {}
): Candidate | null {
  // Paint Mode is the painter's focus screen; only the in-session topper
  // belongs there. Onboarding and settings stay clean.
  if (device.pathname.startsWith('/onboarding') || device.pathname.startsWith('/settings')) {
    return null
  }

  const ranked = messages
    .filter((message) => message.surface === 'popup' || message.surface === 'topper')
    .filter((message) => message.status === 'live' || (includeReview && message.status === 'review'))
    .sort((a, b) => a.priority - b.priority || (a.v1_number ?? 99) - (b.v1_number ?? 99))

  for (const message of ranked) {
    if (message.surface === 'popup' && device.popupShownThisSession) continue
    if (device.pathname.startsWith('/paint-mode') && message.key !== 'assigned_guide_session_topper') {
      continue
    }
    if (isSuppressed(lifecycle, message.message_family, now)) continue

    const target = eligibleTarget(message, lifecycle, now, device)
    if (!target) continue

    return { message, targetId: target.targetId, context: {} }
  }

  return null
}

/**
 * Push cadence (framework 8.3/9): at most 2 per rolling 7 days, At Risk and
 * Dormant get less (one per 7 / 14 days), never the same family twice in 3
 * days, and a user must actually have a subscription.
 */
export function pushCadenceAllows(
  lifecycle: UserLifecycle,
  recentPushTimes: number[],
  family: string,
  now: number
) {
  if (!lifecycle.push_subscription_active) return false
  const last7 = recentPushTimes.filter((at) => now - at < 7 * DAY)
  if (last7.length >= PUSH_MAX_PER_7_DAYS) return false
  if (lifecycle.lifecycle_state === 'at_risk' && last7.length >= 1) return false
  if (
    lifecycle.lifecycle_state === 'dormant' &&
    recentPushTimes.some((at) => now - at < 14 * DAY)
  ) {
    return false
  }
  const familyLast = ms(lifecycle.message_family_last_at?.[family])
  if (familyLast !== null && now - familyLast < 3 * DAY) return false
  if (isSuppressed(lifecycle, family, now)) return false
  return true
}
