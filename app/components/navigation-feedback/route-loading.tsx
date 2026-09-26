'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useNavigationFeedback } from './navigation-provider'
import ReturnSurface from './return-surface'

function CurrentRouteLoading() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const feedback = useNavigationFeedback()
  return <ReturnSurface href={feedback?.href ?? `${pathname}?${searchParams}`} />
}

export default function RouteLoading() {
  const pathname = usePathname()
  return <Suspense fallback={<ReturnSurface href={pathname} />}><CurrentRouteLoading /></Suspense>
}
