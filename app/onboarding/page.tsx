import OnboardingShell from './components/onboarding-shell'
import { createPerfTimer } from '../../utils/perf/server'

export default function OnboardingPage() {
  const perf = createPerfTimer('/onboarding')
  perf.total()

  return <OnboardingShell />
}
