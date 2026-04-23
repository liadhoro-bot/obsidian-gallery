'use client'

import { Recipe } from './types'

export default function RecipeTipsCard({
  recipe,
  isEditingTips,
  setIsEditingTips,
  updateRecipeTipsAction,
}: {
  recipe: Recipe
  isEditingTips: boolean
  setIsEditingTips: (value: boolean) => void
  updateRecipeTipsAction: (formData: FormData) => Promise<void>
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Expert Tips</h2>

        <button
          type="button"
          onClick={() => setIsEditingTips(!isEditingTips)}
          className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        >
          ✎
        </button>
      </div>

      {isEditingTips ? (
        <form action={updateRecipeTipsAction} className="mt-4 space-y-4">
          <input type="hidden" name="recipeId" value={recipe.id} />

          <textarea
            name="expertTips"
            defaultValue={recipe.expert_tips || ''}
            rows={5}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
            >
              Save
            </button>

            <button
              type="button"
              onClick={() => setIsEditingTips(false)}
              className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : recipe.expert_tips ? (
        <div className="mt-4 space-y-4">
          {recipe.expert_tips
            .split('\n')
            .filter(Boolean)
            .map((tip, index) => (
              <p
                key={index}
                className="text-sm italic leading-6 text-neutral-300"
              >
                “{tip}”
              </p>
            ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">No tips added yet.</p>
      )}
    </section>
  )
}