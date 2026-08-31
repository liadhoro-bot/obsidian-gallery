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

type AuthTermsMetadata = {
  terms_accepted_at?: string | null
}

const TERMS_VERSION = '2026-05-13'
const TERMS_ACCEPTANCE_COOKIE = 'og_terms_acceptance'

function hasAcceptedTermsCookie(
  cookieValue: string | undefined,
  userId: string
) {
  if (!cookieValue) {
    return false
  }

  const [acceptedUserId, termsVersion, acceptedAt] = cookieValue.split('|')

  return Boolean(
    acceptedUserId === userId &&
      termsVersion === TERMS_VERSION &&
      acceptedAt &&
      !Number.isNaN(new Date(acceptedAt).getTime())
  )
}

export function resolveDashboardOnboardingRequirement({
  authMetadata,
  hasTermsCookie = false,
  profile,
  termsAcceptance,
  flow,
  unitCount,
}: {
  authMetadata?: AuthTermsMetadata | null
  hasTermsCookie?: boolean
  profile: ProfileTermsRow | null
  termsAcceptance: TermsAcceptanceRow | null
  flow: UserOnboardingFlowRow | null
  unitCount: number | null
}): DashboardOnboardingRequirement {
  const termsAccepted = Boolean(
    profile?.terms_accepted_at ||
      termsAcceptance?.accepted_at ||
      authMetadata?.terms_accepted_at ||
      hasTermsCookie
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
  userId: string,
  authMetadata?: AuthTermsMetadata | null
): Promise<DashboardOnboardingRequirement> {
  const supabase = await createClient()
  let readSupabase = supabase
  let hasTermsCookie = false

  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    hasTermsCookie = hasAcceptedTermsCookie(
      cookieStore.get(TERMS_ACCEPTANCE_COOKIE)?.value,
      userId
    )
  } catch {
    hasTermsCookie = false
  }

  try {
    const { createServiceRoleClient } = await import(
      '../../utils/supabase/service-role'
    )
    readSupabase = createServiceRoleClient()
  } catch {
    readSupabase = supabase
  }

  const [profileResult, termsAcceptanceResult, flowResult, unitResult] =
    await Promise.all([
      readSupabase
        .from('profiles')
        .select('terms_accepted_at')
        .eq('id', userId)
        .maybeSingle(),
      readSupabase
        .from('user_terms_acceptances')
        .select('accepted_at')
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      readSupabase
        .from('user_onboarding_flows')
        .select('flow_name, dismissed_at')
        .eq('user_id', userId)
        .maybeSingle(),
      readSupabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

  const profile = profileResult.data as ProfileTermsRow | null
  const termsAcceptance = termsAcceptanceResult.data as TermsAcceptanceRow | null
  const flow = flowResult.data as UserOnboardingFlowRow | null
  let persistedAuthMetadata = authMetadata

  if (!persistedAuthMetadata && readSupabase !== supabase) {
    const { data } = await readSupabase.auth.admin.getUserById(userId)
    persistedAuthMetadata =
      (data.user?.user_metadata as AuthTermsMetadata | null) ?? null
  }

  return resolveDashboardOnboardingRequirement({
    authMetadata: persistedAuthMetadata,
    hasTermsCookie,
    profile,
    termsAcceptance,
    flow,
    unitCount: unitResult.count,
  })
}
