'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { isPublicNewsPath } from '../../lib/news/public-path'
import MobileNav from '../components/MobileNav'

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

const subscribeToNothing = () => () => {}

// Public news pages show app chrome to members only; the nav's links would
// send a logged-out reader straight to the login page.
function useHasSessionCookie() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => document.cookie.includes('-auth-token'),
    () => false
  )
}

export default function ClientShell({
  enableProductionTelemetry,
}: {
  enableProductionTelemetry: boolean
}) {
  const pathname = usePathname()
  const hasSessionCookie = useHasSessionCookie()
  const isLoggedOutNewsReader = isPublicNewsPath(pathname) && !hasSessionCookie
  const showMobileNav =
    !isLoggedOutNewsReader &&
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
    !isLoggedOutNewsReader &&
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
    </>
  )
}
