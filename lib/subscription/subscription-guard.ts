import 'server-only'

import { unstable_cache } from 'next/cache'
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
 * Freemium: nobody is locked out of the app any more. This flag now only
 * decides whether contest entries are limited to Premium members.
 */
export function isSubscriptionGateEnabled() {
  return process.env.SUBSCRIPTION_REQUIRED === 'true'
}

export function getSubscriptionCacheTag(email: string) {
  return `subscription:${email.trim().toLowerCase()}`
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

export async function getCachedSubscriptionStatus(
  email: string | null | undefined
) {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return INACTIVE_STATUS

  return unstable_cache(
    () => getSubscriptionStatus(normalizedEmail),
    ['subscription-guard', normalizedEmail],
    {
      revalidate: 15,
      tags: [getSubscriptionCacheTag(normalizedEmail)],
    }
  )()
}

/**
 * Of the given users, those with bypass or an active paid subscription.
 * Only they can be contest entries; free accounts cannot. Returns null
 * when the lookup fails so callers can decide how to degrade.
 */
export async function getPayingUserIds(
  userIds: string[]
): Promise<Set<string> | null> {
  if (userIds.length === 0) return new Set()

  const service = createServiceRoleClient()
  const { data: paid, error: paidError } = await service
    .from('subscriptions')
    .select('email')
    .gt('paid_until', new Date().toISOString())

  if (paidError) {
    console.error('[access] paying-users subscriptions lookup failed', paidError)
    return null
  }

  const payingEmails = getBypassEmails()
  for (const row of paid ?? []) {
    const email = String(row.email ?? '').trim().toLowerCase()
    if (email) payingEmails.add(email)
  }

  // subscriptions is keyed by email, so resolve each user's email.
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await service.auth.admin.getUserById(userId)
      if (error) throw error
      const email = data.user?.email?.trim().toLowerCase()
      return email && payingEmails.has(email) ? userId : null
    })
  ).catch((error) => {
    console.error('[access] paying-users email lookup failed', error)
    return null
  })

  if (!results) return null
  return new Set(results.filter((userId): userId is string => Boolean(userId)))
}
