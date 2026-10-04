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
 * Feature flag for the whole gate. Keep this at "false" while you wire up
 * Make/Grow and test with your own account (add yourself to
 * SUBSCRIPTION_BYPASS_EMAILS), then flip it to "true" in Vercel's
 * environment variables when you're ready to require payment for everyone.
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

// ---------------------------------------------------------------------------
// Pricing v2: free trial access. Only consulted after the cutover (see
// lib/subscription/pricing.ts). getSubscriptionStatus above is unchanged and
// still decides bypass and paid (Founder's Pass) access.
// ---------------------------------------------------------------------------

export type AccessState =
  | { status: 'bypass' }
  | { status: 'subscribed'; paidUntil: string | null }
  // endsAt is null only when the trials lookup failed and we failed open.
  | { status: 'trialing'; endsAt: string | null }
  | { status: 'trial_expired'; endsAt: string }
  | { status: 'trial_available' }

export type AccessUser = {
  id: string
  email?: string | null
}

export function hasAppAccess(state: AccessState) {
  return (
    state.status === 'bypass' ||
    state.status === 'subscribed' ||
    state.status === 'trialing'
  )
}

export function getTrialCacheTag(userId: string) {
  return `trial:${userId}`
}

/** Returns the trial's ends_at, null when the user has no trial. Throws on DB errors. */
async function fetchTrialEndsAt(userId: string): Promise<string | null> {
  const { data, error } = await createServiceRoleClient()
    .from('trials')
    .select('ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`trials lookup failed: ${error.message}`)
  }

  return (data?.ends_at as string | undefined) ?? null
}

function getCachedTrialEndsAt(userId: string) {
  return unstable_cache(
    () => fetchTrialEndsAt(userId),
    ['trial-guard', userId],
    {
      revalidate: 15,
      tags: [getTrialCacheTag(userId)],
    }
  )()
}

function trialStateFromEndsAt(endsAt: string | null, now: Date): AccessState {
  if (!endsAt) {
    return { status: 'trial_available' }
  }

  return new Date(endsAt).getTime() > now.getTime()
    ? { status: 'trialing', endsAt }
    : { status: 'trial_expired', endsAt }
}

function subscriptionAccessState(
  subscription: SubscriptionStatus
): AccessState | null {
  if (!subscription.isActive) return null
  if (subscription.planName === 'bypass') return { status: 'bypass' }
  return { status: 'subscribed', paidUntil: subscription.paidUntil }
}

/**
 * Order: bypass, subscribed (covers Founder's Pass), then the trial. The
 * subscriptions check keeps failing closed; a trials lookup error fails open
 * (treated as trialing) so a DB hiccup never locks people out.
 */
export async function getAccessState(
  user: AccessUser,
  now: Date = new Date()
): Promise<AccessState> {
  const fromSubscription = subscriptionAccessState(
    await getSubscriptionStatus(user.email)
  )
  if (fromSubscription) return fromSubscription

  try {
    return trialStateFromEndsAt(await fetchTrialEndsAt(user.id), now)
  } catch (error) {
    console.error('[access] trials lookup failed, allowing access', error)
    return { status: 'trialing', endsAt: null }
  }
}

/** Same as getAccessState, backed by short-lived caches for the proxy. */
export async function getCachedAccessState(
  user: AccessUser,
  now: Date = new Date()
): Promise<AccessState> {
  const fromSubscription = subscriptionAccessState(
    await getCachedSubscriptionStatus(user.email)
  )
  if (fromSubscription) return fromSubscription

  try {
    const cachedEndsAt = await getCachedTrialEndsAt(user.id)
    // Never redirect to /trial on a cached "no trial" answer: the trial may
    // have started moments ago. Confirm against the database first.
    const endsAt = cachedEndsAt ?? (await fetchTrialEndsAt(user.id))
    return trialStateFromEndsAt(endsAt, now)
  } catch (error) {
    console.error('[access] trials lookup failed, allowing access', error)
    return { status: 'trialing', endsAt: null }
  }
}

/**
 * Of the given users, those with bypass or an active paid subscription.
 * Only they can be contest entries; free-trial users cannot. Returns null
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
