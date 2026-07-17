'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { prefetchRoute } from '../components/route-prefetch'

export default function DashboardResumeButton({
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
      onClick={() => {
        if (isNavigating) {
          return
        }

        setIsNavigating(true)
        router.push(href, { scroll: false })
      }}
      className="inline-flex rounded-2xl border border-cyan-300/55 bg-black/45 px-4 py-2.5 text-xs font-black uppercase text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.22)] backdrop-blur-md transition hover:border-cyan-200/80 hover:bg-cyan-400/15 hover:text-cyan-50 active:bg-cyan-400 active:text-slate-950 sm:px-5 sm:py-3 sm:text-sm disabled:opacity-70"
      disabled={isNavigating}
    >
      {isNavigating ? 'Opening...' : 'Resume Painting'}
    </button>
  )
}
