'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import PrefetchLink from '../components/prefetch-link'

export default function DashboardQuickActionStartButton({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const [showStartOptions, setShowStartOptions] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowStartOptions(true)}
        className={className}
      >
        {children}
      </button>

      {showStartOptions ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-24 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Start Project or Unit"
          onClick={() => setShowStartOptions(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-cyan-300/45 bg-[#061018]/95 p-4 shadow-[0_0_34px_rgba(34,211,238,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                Start
              </p>
              <button
                type="button"
                onClick={() => setShowStartOptions(false)}
                className="tap-press tap-target rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-bold text-white/70 hover:border-cyan-300/40 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <PrefetchLink
                href="/projects?tab=create"
                prefetchHref="/projects"
                className="tap-card rounded-xl border border-cyan-300/45 bg-black/45 px-4 py-5 text-center text-sm font-black text-white shadow-[0_0_16px_rgba(34,211,238,0.12)] hover:bg-cyan-300/[0.08]"
              >
                Project
              </PrefetchLink>
              <PrefetchLink
                href="/units/new"
                prefetchHref="/units/new"
                className="tap-card rounded-xl border border-cyan-300/45 bg-black/45 px-4 py-5 text-center text-sm font-black text-white shadow-[0_0_16px_rgba(34,211,238,0.12)] hover:bg-cyan-300/[0.08]"
              >
                Unit
              </PrefetchLink>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
