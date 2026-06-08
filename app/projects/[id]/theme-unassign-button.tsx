'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { unassignProjectTheme } from './actions'
import { unassignUnitTheme } from '../../units/[id]/actions'

type Props = {
  projectId: string
  unitId?: string
  themeId: string
}

export default function ThemeUnassignButton({
  projectId,
  unitId,
  themeId,
}: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function confirmUnassign() {
    const formData = new FormData()
    formData.set('themeId', themeId)

    if (unitId) {
      formData.set('unitId', unitId)
    } else {
      formData.set('projectId', projectId)
    }

    startTransition(async () => {
      if (unitId) {
        await unassignUnitTheme(formData)
      } else {
        await unassignProjectTheme(formData)
      }

      setIsOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55 transition hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-200 active:scale-95"
      >
        Unassign
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unassign-theme-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#10131a] p-4 shadow-2xl">
            <h2 id="unassign-theme-title" className="text-base font-bold">
              Unassign theme?
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Are you sure you want to unassign this theme? The theme and its
              paints will not be deleted.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUnassign}
                disabled={isPending}
                className="rounded-xl bg-red-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-red-300 disabled:opacity-50"
              >
                {isPending ? 'Unassigning...' : 'Unassign'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
