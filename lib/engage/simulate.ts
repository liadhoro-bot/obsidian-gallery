import { eligibleTarget, pickInAppCandidate, type DeviceInfo } from './candidates'
import type { EngagementMessage, MessageSurface, UserLifecycle } from './types'

// "Who gets what": runs the same selection rules the app and the daily push
// run use, for one user, as if every message in review were live. The admin
// page uses it to draw the map and the per-user table.

export const MESSAGE_LABELS: Record<string, string> = {
  push_opt_in_popup: 'Turn on push · Active',
  push_opt_in_return_popup: 'Turn on push · coming back',
  push_opt_in_topper: 'Turn on push · strip',
  session_next_step_popup: 'Set next step',
  resume_unit_topper: 'Resume unit',
  saved_guide_assign_popup: 'Assign saved guide',
  assigned_guide_session_topper: 'Guide step ready',
  stale_unit_push: 'Unit on the bench',
  at_risk_return_push: 'One session is enough',
  dormant_return_push: 'Still on the bench',
  social_reward_push: 'Someone saved your guide',
  at_risk_return_email: 'Personal email',
}

export function messageLabel(key: string) {
  return MESSAGE_LABELS[key] ?? key
}

export type PushOutcome =
  | { kind: 'send'; key: string }
  | { kind: 'held'; key: string } // matches, but the frequency limit holds it today
  | { kind: 'unreachable'; wouldGet: string | null } // push is off
  | { kind: 'nothing' }

export type UserPlan = {
  inApp: { key: string; surface: MessageSurface } | null
  push: PushOutcome
  email: string | null
}

/** What this user's device would report, judged from the server side. */
export function deviceFromLifecycle(lifecycle: UserLifecycle, pathname = '/dashboard'): DeviceInfo {
  const permission = lifecycle.push_platform_permission
  return {
    push: lifecycle.push_subscription_active
      ? 'on'
      : permission === 'denied'
        ? 'denied'
        : permission === 'unsupported'
          ? 'unsupported'
          : 'off',
    popupShownThisSession: false,
    pathname,
  }
}

export function simulateUser(
  lifecycle: UserLifecycle,
  messages: EngagementMessage[],
  plannedPushKey: string | undefined,
  now: number
): UserPlan {
  const usable = messages.filter((message) => message.status !== 'draft' && message.status !== 'paused')

  const pick = pickInAppCandidate(usable, lifecycle, deviceFromLifecycle(lifecycle), now, { includeReview: true })
  const inApp = pick ? { key: pick.message.key, surface: pick.message.surface } : null

  const pushMessages = usable
    .filter((message) => message.surface === 'push')
    .sort((a, b) => a.priority - b.priority || (a.v1_number ?? 99) - (b.v1_number ?? 99))
  const firstEligiblePush = pushMessages.find((message) => eligibleTarget(message, lifecycle, now) !== null)

  let push: PushOutcome
  if (plannedPushKey) push = { kind: 'send', key: plannedPushKey }
  else if (!lifecycle.push_subscription_active) push = { kind: 'unreachable', wouldGet: firstEligiblePush?.key ?? null }
  else if (firstEligiblePush) push = { kind: 'held', key: firstEligiblePush.key }
  else push = { kind: 'nothing' }

  const emailMessage = usable.find((message) => message.surface === 'email')
  const email = emailMessage && eligibleTarget(emailMessage, lifecycle, now) ? emailMessage.key : null

  return { inApp, push, email }
}
