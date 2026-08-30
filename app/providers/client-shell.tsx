'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import MobileNav from '../components/MobileNav'

const ServiceWorkerRegistrar = dynamic(
  () => import('./service-worker-registrar'),
  { ssr: false }
)
const MobileInstallPrompt = dynamic(
  () => import('../components/mobile-install-prompt'),
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
    !pathname.startsWith('/guides/decks')
  const showInstallPrompt =
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/offline') &&
    !pathname.startsWith('/settings/terms')

  return (
    <>
      <ServiceWorkerRegistrar />
      {showInstallPrompt ? <MobileInstallPrompt /> : null}
      {enableProductionTelemetry ? <PostHogUserIdentifier /> : null}
      {showMobileNav ? <MobileNav /> : null}
    </>
  )
}
