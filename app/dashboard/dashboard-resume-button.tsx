'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { prefetchRoute } from '../components/route-prefetch'
import { paintModeHref } from '../paint-mode/paint-mode-href'
import { startUnitSession } from '../units/[id]/actions'
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
  // Starts (or picks up) the unit's session, then paints in Paint Mode.
  const href = paintModeHref(unitId, { preview: searchParams.get('preview') === '1' })

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
        void startUnitSession(unitId, new Date().toISOString())
          .then(() => router.push(href, { scroll: false }))
          .catch((error) => {
            console.error('[dashboard] start painting', error)
            setIsNavigating(false)
          })
      }}
      className={styles.inlineLinkButton}
      disabled={isNavigating}
    >
      {icon}
      {isNavigating ? 'Opening...' : (label ?? 'Resume Painting')}
    </button>
  )
}
