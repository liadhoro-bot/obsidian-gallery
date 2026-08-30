import { createClient } from '../../utils/supabase/server'

export type DashboardOnboardingReason = 'missing_goal' | 'missing_units'

export type DashboardOnboardingRequirement = {
  hasGoal: boolean
  hasUnits: boolean
  needsOnboarding: boolean
  reason: DashboardOnboardingReason | null
  termsAccepted: boolean
}

type ProfileTermsRow = {
  terms_accepted_at: string | null
}

type UserOnboardingFlowRow = {
  flow_name: string | null
}

export function getOnboardingRedirectPath({
  preview = false,
  reason,
}: {
  preview?: boolean
  reason: DashboardOnboardingReason
}) {
  const params = new URLSearchParams({
    reason,
  })

  if (preview) {
    params.set('preview', '1')
  }

  return `/onboarding?${params.toString()}`
}

export async function getDashboardOnboardingRequirement(
  userId: string
): Promise<DashboardOnboardingRequirement> {
  const supabase = await createClient()

  const [profileResult, flowResult, unitResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('terms_accepted_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_onboarding_flows')
      .select('flow_name')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  const profile = profileResult.data as ProfileTermsRow | null
  const flow = flowResult.data as UserOnboardingFlowRow | null
  const termsAccepted = Boolean(profile?.terms_accepted_at)
  const hasGoal = Boolean(flow?.flow_name)
  const hasUnits = (unitResult.count ?? 0) > 0
  const reason = !hasGoal ? 'missing_goal' : !hasUnits ? 'missing_units' : null

  return {
    hasGoal,
    hasUnits,
    needsOnboarding: Boolean(reason),
    reason,
    termsAccepted,
  }
}
