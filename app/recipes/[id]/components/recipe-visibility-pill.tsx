'use client'

import { useState } from 'react'
import SubmitButton from '../../../components/SubmitButton'

export default function RecipeVisibilityPill({
  recipeId,
  isPublic,
  updateRecipeVisibilityAction,
}: {
  recipeId: string
  isPublic: boolean
  updateRecipeVisibilityAction: (formData: FormData) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={[
          'rounded-full px-3 py-1 text-xs font-semibold transition',
          isPublic
            ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-300/30'
            : 'bg-slate-700/70 text-slate-300 ring-1 ring-white/10',
        ].join(' ')}
      >
        {isPublic ? 'Public' : 'Private'}
      </button>

      {isOpen && (
        <form
          action={updateRecipeVisibilityAction}
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-xl"
        >
          <input type="hidden" name="recipeId" value={recipeId} />
          <input type="hidden" name="isPublic" value={String(!isPublic)} />

          <p className="text-sm leading-relaxed text-slate-200">
            {isPublic
              ? 'Make this guide private again? Other members will no longer be able to view it.'
              : 'Are you sure you would like to make this guide public, and enable other members to view it?'}
          </p>

          <div className="mt-4 flex gap-2">
            <SubmitButton
              idleText={isPublic ? 'Make private' : 'Make public'}
              pendingText={isPublic ? 'Updating...' : 'Publishing...'}
              className={
                isPublic
                  ? 'rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-slate-100'
                  : 'rounded-full bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950'
              }
            />

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
