'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
        router.push(href, { scroll: false })
      }}
      className="rounded-xl border border-cyan-300/55 bg-black/55 px-2.5 py-1.5 text-[10px] font-black uppercase text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950 disabled:opacity-70"
      disabled={isNavigating}
    >
      {isNavigating ? 'Opening...' : 'Start Painting'}
    </button>
  )
}
