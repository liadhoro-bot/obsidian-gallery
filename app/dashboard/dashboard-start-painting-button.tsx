'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { prefetchRoute } from '../components/route-prefetch'
import { paintModeHref } from '../paint-mode/paint-mode-href'
import { startUnitSession } from '../units/[id]/actions'

export default function DashboardStartPaintingButton({
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
      onClick={(event) => {
        event.stopPropagation()

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
      className="rounded-xl border border-cyan-300/55 bg-black/55 px-2.5 py-1.5 text-[10px] font-black uppercase text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950 disabled:opacity-70"
      disabled={isNavigating}
    >
      {isNavigating ? 'Opening...' : (label ?? 'Start Painting')}
    </button>
  )
}
