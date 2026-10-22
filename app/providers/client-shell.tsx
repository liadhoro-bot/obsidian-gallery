'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import MobileNav from '../components/MobileNav'
import ScrollingHelp from '../components/scrolling-help'

const ServiceWorkerRegistrar = dynamic(
  () => import('./service-worker-registrar'),
  { ssr: false }
)
const MobileInstallPrompt = dynamic(
  () => import('../components/mobile-install-prompt'),
  { ssr: false }
)
const OnboardingTour = dynamic(
  () => import('../components/onboarding-tour/onboarding-tour'),
  { ssr: false }
)
const PostHogUserIdentifier = dynamic(
  () => import('./posthog-user-identifier'),
  { ssr: false }
)

export default function ClientShell({
  enableProductionTelemetry,
}: {
  enableProductionTelemetry: boolean
}) {
  const pathname = usePathname()
  const showMobileNav =
    pathname !== '/' &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/offline') &&
    !pathname.startsWith('/support') &&
    !pathname.startsWith('/settings/terms') &&
    !pathname.startsWith('/guides/decks') &&
    !pathname.startsWith('/s/') &&
    !pathname.startsWith('/subscribe') &&
    !pathname.startsWith('/payment-success') &&
    !pathname.startsWith('/trial')
  const showInstallPrompt =
    !pathname.startsWith('/s/') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/offline') &&
    !pathname.startsWith('/settings/terms') &&
    !pathname.startsWith('/subscribe') &&
    !pathname.startsWith('/payment-success') &&
    !pathname.startsWith('/trial')

  return (
    <>
      <ServiceWorkerRegistrar />
      {showInstallPrompt ? <MobileInstallPrompt /> : null}
      {enableProductionTelemetry ? <PostHogUserIdentifier /> : null}
      {showMobileNav ? <MobileNav /> : null}
      {showMobileNav ? <OnboardingTour /> : null}
      {showMobileNav ? <ScrollingHelp /> : null}
    </>
  )
}
