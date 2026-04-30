'use client'

import { Recipe, RecipeImage } from './types'
import RecipeVisibilityPill from './recipe-visibility-pill'
import { updateRecipeVisibility } from '../recipe-actions'

export default function RecipeHero({
  recipe,
  featuredImage,
  isEditingHeader,
  setIsEditingHeader,
  updateRecipeHeaderAction,
}: {
  recipe: Recipe
  featuredImage: RecipeImage | null
  isEditingHeader: boolean
  setIsEditingHeader: (value: boolean) => void
  updateRecipeHeaderAction: (formData: FormData) => Promise<void>
}) {
  return (
    <section className="mt-4 border-y border-neutral-800 bg-neutral-950">
      <div className="relative">
        {featuredImage ? (
          <>
            <div
              className={`${isEditingHeader ? 'h-72' : 'h-56'} w-full bg-cover bg-center`}
              style={{ backgroundImage: `url(${featuredImage.image_url})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
          </>
        ) : (
          <div className={`${isEditingHeader ? 'h-72' : 'h-56'} w-full bg-neutral-900`} />
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
                Recipe Detail
              </p>

              <h1 className="mt-2 text-4xl font-bold text-white">
                {recipe.name}
              </h1>

              <p className="mt-3 max-w-lg text-sm text-neutral-300">
                {recipe.description || 'No description yet.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
  <RecipeVisibilityPill
    recipeId={recipe.id}
    isPublic={recipe.is_public}
    updateRecipeVisibilityAction={updateRecipeVisibility}
  />

  <button
    type="button"
    onClick={() => setIsEditingHeader(!isEditingHeader)}
    className="rounded-full border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
    title="Edit title and description"
  >
    ✎
  </button>
</div>
          </div>
        </div>
      </div>

      {isEditingHeader ? (
        <div className="px-5 pb-5">
          <form
            action={updateRecipeHeaderAction}
            className="-mt-2 rounded-2xl border border-neutral-700 bg-black/85 p-4"
          >
            <input type="hidden" name="recipeId" value={recipe.id} />

            <div className="mb-3">
              <p className="text-sm font-medium text-white">
                Edit Title and Description
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                This form updates both the recipe title and the description.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Title
                </label>
                <input
                  name="name"
                  type="text"
                  defaultValue={recipe.name}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={recipe.description || ''}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingHeader(false)}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}