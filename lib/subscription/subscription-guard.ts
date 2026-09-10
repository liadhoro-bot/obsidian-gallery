import 'server-only'

import { createServiceRoleClient } from '../../utils/supabase/service-role'

export type SubscriptionStatus = {
  isActive: boolean
  paidUntil: string | null
  planName: string | null
}

const INACTIVE_STATUS: SubscriptionStatus = {
  isActive: false,
  paidUntil: null,
  planName: null,
}

function getBypassEmails() {
  return new Set(
    (process.env.SUBSCRIPTION_BYPASS_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Feature flag for the whole gate. Keep this at "false" while you wire up
 * Make/Grow and test with your own account (add yourself to
 * SUBSCRIPTION_BYPASS_EMAILS), then flip it to "true" in Vercel's
 * environment variables when you're ready to require payment for everyone.
 */
export function isSubscriptionGateEnabled() {
  return process.env.SUBSCRIPTION_REQUIRED === 'true'
}

export async function getSubscriptionStatus(
  email: string | null | undefined
): Promise<SubscriptionStatus> {
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    return INACTIVE_STATUS
  }

  if (getBypassEmails().has(normalizedEmail)) {
    return { isActive: true, paidUntil: null, planName: 'bypass' }
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('subscriptions')
    .select('paid_until, plan_name')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (error || !data?.paid_until) {
    return INACTIVE_STATUS
  }

  const isActive = new Date(data.paid_until).getTime() > Date.now()

  if (!isActive) {
    return { isActive: false, paidUntil: data.paid_until, planName: data.plan_name ?? null }
  }

  return {
    isActive: true,
    paidUntil: data.paid_until,
    planName: data.plan_name ?? null,
  }
}
