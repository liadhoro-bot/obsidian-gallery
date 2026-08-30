import { createClient } from '../../utils/supabase/server'

export type DashboardOnboardingReason = 'missing_goal' | 'missing_units'

export type DashboardOnboardingRequirement = {
  hasGoal: boolean
  hasUnits: boolean
  needsOnboarding: boolean
  reason: DashboardOnboardingReason | null
  termsAccepted: boolean
  flowName: string | null
}

type ProfileTermsRow = {
  terms_accepted_at: string | null
}

type UserOnboardingFlowRow = {
  flow_name: string | null
  dismissed_at?: string | null
}

type TermsAcceptanceRow = {
  accepted_at: string | null
}

export function resolveDashboardOnboardingRequirement({
  profile,
  termsAcceptance,
  flow,
  unitCount,
}: {
  profile: ProfileTermsRow | null
  termsAcceptance: TermsAcceptanceRow | null
  flow: UserOnboardingFlowRow | null
  unitCount: number | null
}): DashboardOnboardingRequirement {
  const termsAccepted = Boolean(
    profile?.terms_accepted_at || termsAcceptance?.accepted_at
  )
  const hasGoal = Boolean(flow)
  const hasUnits = (unitCount ?? 0) > 0
  const requiresUnitSetup =
    !flow?.dismissed_at &&
    (flow?.flow_name === 'paint_miniature' ||
      flow?.flow_name === 'organize_hobby')
  const reason = !hasGoal
    ? 'missing_goal'
    : requiresUnitSetup && !hasUnits
      ? 'missing_units'
      : null

  return {
    hasGoal,
    hasUnits,
    needsOnboarding: Boolean(reason),
    reason,
    termsAccepted,
    flowName: flow?.flow_name ?? null,
  }
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

  const [profileResult, termsAcceptanceResult, flowResult, unitResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('terms_accepted_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_terms_acceptances')
        .select('accepted_at')
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_onboarding_flows')
        .select('flow_name, dismissed_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

  const profile = profileResult.data as ProfileTermsRow | null
  const termsAcceptance = termsAcceptanceResult.data as TermsAcceptanceRow | null
  const flow = flowResult.data as UserOnboardingFlowRow | null

  return resolveDashboardOnboardingRequirement({
    profile,
    termsAcceptance,
    flow,
    unitCount: unitResult.count,
  })
}
