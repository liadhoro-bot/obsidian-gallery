import OnboardingShell from './components/onboarding-shell'

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

  return <OnboardingShell key={params?.reset ?? 'default'} previewMode />
}
