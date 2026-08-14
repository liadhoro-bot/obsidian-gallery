'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { OgButton } from '@/src/components/v3'
import { prefetchRoute } from '../components/route-prefetch'
import styles from './dashboard-og.module.css'

export default function DashboardResumeButton({
  icon,
  label = 'Resume Painting',
  unitId,
}: {
  icon?: ReactNode
  label?: string
  unitId: string
}) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const href = `/units/${unitId}?session=started&autostart=1`

  return (
    <OgButton
      icon={icon}
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
      loading={isNavigating}
      variant="primary"
    >
      {isNavigating ? 'Opening...' : label}
    </OgButton>
  )
}
