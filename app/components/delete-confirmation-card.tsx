'use client'

import { useState } from 'react'

type Props = {
  itemId: string
  itemIdFieldName: string
  title: string
  buttonLabel: string
  initialDescription: string
  confirmDescription: string
  deleteAction: (formData: FormData) => Promise<void>
}

export default function DeleteConfirmationCard({
  itemId,
  itemIdFieldName,
  title,
  buttonLabel,
  initialDescription,
  confirmDescription,
  deleteAction,
}: Props) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleteArmed, setIsDeleteArmed] = useState(false)

  if (!isConfirming) {
    return (
      <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-sm font-bold uppercase tracking-wider text-red-400">
          Danger Zone
        </p>

        <h2 className="mt-2 text-xl font-semibold text-white">
          {title}
        </h2>

        <p className="mt-3 text-sm text-neutral-400">
          {initialDescription}
        </p>

        <button
          type="button"
          onClick={() => {
            setIsConfirming(true)
            setIsDeleteArmed(false)
          }}
          className="mt-5 w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
        >
          {buttonLabel}
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
      <p className="text-sm font-bold uppercase tracking-wider text-red-400">
        Confirm Deletion
      </p>

      <h2 className="mt-2 text-xl font-semibold text-white">
        Are you sure?
      </h2>

      <p className="mt-3 text-sm leading-6 text-neutral-300">
        {confirmDescription}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setIsConfirming(false)
            setIsDeleteArmed(false)
          }}
          className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-bold text-slate-200 transition hover:bg-white/15"
        >
          Cancel
        </button>

        <form action={deleteAction}>
          <input type="hidden" name={itemIdFieldName} value={itemId} />

          <button
            type="submit"
            onClick={(event) => {
              if (!isDeleteArmed) {
                event.preventDefault()
                setIsDeleteArmed(true)
              }
            }}
            className={[
              'w-full rounded-2xl border px-5 py-4 text-sm font-black transition',
              isDeleteArmed
                ? 'border-red-400 bg-red-600 text-white shadow-[0_0_24px_rgba(239,68,68,0.35)] hover:bg-red-500'
                : 'border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30',
            ].join(' ')}
          >
            Delete Anyway
          </button>
        </form>
      </div>
    </section>
  )
}
