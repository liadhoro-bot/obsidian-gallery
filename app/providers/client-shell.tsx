'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const MobileNav = dynamic(() => import('../components/MobileNav'), {
  ssr: false,
})
const ServiceWorkerRegistrar = dynamic(
  () => import('./service-worker-registrar'),
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
    !pathname.startsWith('/settings/terms')

  return (
    <>
      <ServiceWorkerRegistrar />
      {enableProductionTelemetry ? <PostHogUserIdentifier /> : null}
      {showMobileNav ? <MobileNav /> : null}
    </>
  )
}
