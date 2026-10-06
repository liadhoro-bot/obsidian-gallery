'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { clearDashboardReturn, setDashboardReturnUser } from '@/app/dashboard/dashboard-return-store'
import { subscribeToDashboardSync } from '@/app/dashboard/dashboard-sync'

export default function DashboardCacheLifecycle() {
  const pathname = usePathname()
  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setDashboardReturnUser(session?.user.id ?? null)
    })
    const unsubscribe = subscribeToDashboardSync(clearDashboardReturn)
    return () => { subscription.unsubscribe(); unsubscribe() }
  }, [])
  useEffect(() => {
    if (/^\/(login|auth|onboarding|subscribe)(\/|$)/.test(pathname)) clearDashboardReturn()
  }, [pathname])
  return null
}
