'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { getDashboardReturn, subscribeDashboardReturn } from '@/app/dashboard/dashboard-return-store'
import LoadingSurface from './loading-surface'

const serverSnapshot = () => null

export default function ReturnSurface(props: Parameters<typeof LoadingSurface>[0]) {
  const url = new URL(props.href ?? '/', 'https://navigation.local')
  const tab = url.searchParams.get('tab') === 'profile' ? 'profile' : 'painting-table'
  const getSnapshot = useCallback(() => getDashboardReturn(tab), [tab])
  const snapshot = useSyncExternalStore(subscribeDashboardReturn, getSnapshot, serverSnapshot)
  if (snapshot && url.pathname === '/dashboard' && !url.searchParams.has('golden')) {
    return <div data-dashboard-return-content>{snapshot.render(`${url.pathname}${url.search}`)}</div>
  }
  return <LoadingSurface {...props} />
}
