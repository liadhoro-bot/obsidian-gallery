'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toggleThemeVisibility } from './actions'

type Props = {
  themeId: string
  isPublic: boolean
}

export default function ThemeVisibilityPill({
  themeId,
  isPublic,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function confirmToggle() {
    startTransition(async () => {
      await toggleThemeVisibility(themeId, !isPublic)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full border px-3 py-1 text-xs transition ${
          isPublic
            ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
            : 'border-white/10 bg-white/[0.05] text-white/60'
        }`}
      >
        {isPublic ? 'Public theme' : 'Private theme'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#10131a] p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white">
              {isPublic ? 'Make theme private?' : 'Make theme public?'}
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/60">
              {isPublic
                ? 'Making this theme private will hide it from other users. Only you will be able to view and edit it.'
                : 'Making this theme public will allow other users to view it. They will not be able to edit it.'}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmToggle}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
              >
                {isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : null}
                <span>
                  {isPending
                    ? 'Updating...'
                    : isPublic
                      ? 'Make Private'
                      : 'Make Public'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
