'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OgButton } from '@/src/components/v3'
import { prefetchRoute } from '../components/route-prefetch'

export default function DashboardStartPaintingButton({
  unitId,
}: {
  unitId: string
}) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)
  const href = `/units/${unitId}?session=started&autostart=1`

  return (
    <OgButton
      onPointerEnter={() => {
        prefetchRoute(router, href)
      }}
      onClick={(event) => {
        event.stopPropagation()

        if (isNavigating) {
          return
        }

        setIsNavigating(true)
        router.push(href, { scroll: false })
      }}
      disabled={isNavigating}
      loading={isNavigating}
      size="compact"
      variant="primary"
    >
      {isNavigating ? 'Opening...' : 'Start Painting'}
    </OgButton>
  )
}
