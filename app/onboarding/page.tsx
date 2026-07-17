import OnboardingShell from './components/onboarding-shell'
import { createPerfTimer } from '../../utils/perf/server'

type OnboardingPageProps = {
  searchParams: Promise<{
    preview?: string | string[]
  }>
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const perf = createPerfTimer('/onboarding')
  perf.total()
  const params = await searchParams
  const preview = Array.isArray(params.preview)
    ? params.preview[0]
    : params.preview
  const isPreview = preview === '1' || preview === 'true'

  return <OnboardingShell previewMode={isPreview} />
}
