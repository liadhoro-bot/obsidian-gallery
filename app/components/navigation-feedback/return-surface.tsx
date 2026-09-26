'use client'

import { useSyncExternalStore } from 'react'
import { getDashboardReturn, subscribeDashboardReturn } from '@/app/dashboard/dashboard-return-store'
import LoadingSurface from './loading-surface'

const serverSnapshot = () => null

export default function ReturnSurface(props: Parameters<typeof LoadingSurface>[0]) {
  const snapshot = useSyncExternalStore(subscribeDashboardReturn, getDashboardReturn, serverSnapshot)
  const url = new URL(props.href ?? '/', 'https://navigation.local')
  // Progress is streamed separately and isn't included in the units snapshot.
  if (snapshot && url.pathname === '/dashboard' && url.searchParams.get('tab') !== 'profile'
    && !url.searchParams.has('golden')) {
    return <div data-dashboard-return-content>{snapshot.render(`${url.pathname}${url.search}`)}</div>
  }
  return <LoadingSurface {...props} />
}
