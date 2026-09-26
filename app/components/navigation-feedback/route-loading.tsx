'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationFeedback } from './navigation-provider'
import LoadingSurface from './loading-surface'

function CurrentRouteLoading() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const feedback = useNavigationFeedback()
  return <LoadingSurface href={feedback?.href ?? `${pathname}?${searchParams}`} />
}

export default function RouteLoading() {
  const pathname = usePathname()
  return <Suspense fallback={<LoadingSurface href={pathname} />}><CurrentRouteLoading /></Suspense>
}
