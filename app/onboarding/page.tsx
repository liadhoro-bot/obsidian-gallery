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
    reset?: string
  }>
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
      initialStep={
        previewMode || onboarding?.termsAccepted === false ? 'terms' : 'persona'
      }
      previewMode={previewMode}
      requireUnitSetup={onboarding?.hasUnits === false}
    />
  )
}
