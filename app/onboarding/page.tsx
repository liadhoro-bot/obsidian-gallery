import OnboardingShell from './components/onboarding-shell'
import { isV3PreviewValue } from '../../lib/v3-preview'

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

  return (
    <OnboardingShell
      key={params?.reset ?? 'default'}
      previewMode={previewMode}
    />
  )
}
