'use client'

import { useState } from 'react'

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

      {isOpen && !isPublic && (
        <form
          action={updateRecipeVisibilityAction}
          className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-xl"
        >
          <input type="hidden" name="recipeId" value={recipeId} />
          <input type="hidden" name="isPublic" value="true" />

          <p className="text-sm leading-relaxed text-slate-200">
            Are you sure you would like to make this recipe public, and enable
            other members to view it?
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950"
            >
              Make public
            </button>

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