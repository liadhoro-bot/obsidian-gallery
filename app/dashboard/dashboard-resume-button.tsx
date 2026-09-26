'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { prefetchRoute } from '../components/route-prefetch'
import styles from './dashboard-og.module.css'

export default function DashboardResumeButton({
  icon,
  label,
  unitId,
}: {
  icon?: ReactNode
  label?: string
  unitId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)
  const href = `/units/${unitId}?session=started&autostart=1${
    searchParams.get('preview') === '1' ? '&preview=1' : ''
  }`

  return (
    <button
      type="button"
      onPointerEnter={() => {
        prefetchRoute(router, href)
      }}
      onClick={() => {
        if (isNavigating) {
          return
        }

        setIsNavigating(true)
        router.push(href, { scroll: false })
      }}
      className={styles.inlineLinkButton}
      disabled={isNavigating}
    >
      {icon}
      {isNavigating ? 'Opening...' : (label ?? 'Resume Painting')}
    </button>
  )
}
