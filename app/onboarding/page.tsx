import OnboardingShell from './components/onboarding-shell'
import { isV3PreviewValue } from '../../lib/v3-preview'
import { redirect } from 'next/navigation'
import {
  createClient,
  getSessionUser,
} from '../../utils/supabase/server'
import { getDashboardOnboardingRequirement } from '../../lib/onboarding/dashboard-entry-guard'

type OnboardingPageProps = {
  searchParams?: Promise<{
    preview?: string
    reason?: string
    reset?: string
  }>
}

function getInitialStep({
  previewMode,
  reason,
  termsAccepted,
}: {
  previewMode: boolean
  reason?: string
  termsAccepted?: boolean
}) {
  if (previewMode || termsAccepted === false) {
    return 'terms'
  }

  if (reason === 'missing_units') {
    return 'creation'
  }

  return 'persona'
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined
  const previewMode = isV3PreviewValue(params?.preview)
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const onboarding = user
    ? await getDashboardOnboardingRequirement(user.id)
    : null

  if (!previewMode && !user) {
    redirect('/login?next=%2Fonboarding')
  }

  return (
    <OnboardingShell
      key={params?.reset ?? 'default'}
      initialStep={getInitialStep({
        previewMode,
        reason: params?.reason,
        termsAccepted: onboarding?.termsAccepted,
      })}
      initialGoal={
        onboarding?.flowName === 'organize_hobby'
          ? 'organize_hobby'
          : onboarding?.flowName === 'create_content'
            ? 'create_content'
            : 'paint_miniature'
      }
      previewMode={previewMode}
      hasAuthenticatedUser={Boolean(user)}
      requireUnitSetup={onboarding?.hasUnits === false}
    />
  )
}
