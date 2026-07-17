'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Recipe, RecipeImage } from './types'
import BackButton from '../../../components/back-button'
import DeleteConfirmationCard from '../../../components/delete-confirmation-card'
import RecipeVisibilityPill from './recipe-visibility-pill'
import { updateRecipeVisibility } from '../recipe-actions'

export default function RecipeHero({
  recipe,
  isOwner,
  featuredImage,
  isEditingHeader,
  setIsEditingHeader,
  updateRecipeHeaderAction,
  deleteRecipeAction,
}: {
  recipe: Recipe
  isOwner: boolean
  featuredImage: RecipeImage | null
  isEditingHeader: boolean
  setIsEditingHeader: (value: boolean) => void
  updateRecipeHeaderAction: (formData: FormData) => Promise<void>
  deleteRecipeAction: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleUpdateHeader(formData: FormData) {
    startTransition(async () => {
      await updateRecipeHeaderAction(formData)
      setIsEditingHeader(false)
      router.refresh()
    })
  }

  return (
    <section className="mt-4 border-y border-neutral-800 bg-neutral-950">
      <div className="relative">
        <div className="absolute left-4 top-4 z-20">
          <BackButton fallbackHref="/recipes" />
        </div>

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

        {isOwner ? (
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
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
              Edit
            </button>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
            Guide
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            {recipe.name}
          </h1>
        </div>
      </div>

      {isOwner && isEditingHeader ? (
        <div className="space-y-4 px-5 pb-5">
          <form
            action={handleUpdateHeader}
            className="rounded-2xl border border-neutral-700 bg-black/85 p-4"
          >
            <input type="hidden" name="recipeId" value={recipe.id} />

            <div className="mb-3">
              <p className="text-sm font-medium text-white">
                Edit Title and Description
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                This form updates both the guide title and the description.
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
                  disabled={isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : null}
                  <span>{isPending ? 'Saving...' : 'Save'}</span>
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

          <DeleteConfirmationCard
            itemId={recipe.id}
            itemIdFieldName="recipeId"
            title="Delete Guide"
            buttonLabel="Delete This Guide"
            initialDescription="Permanently delete this guide from your gallery."
            confirmDescription="If you delete this guide, it will be removed along with all the steps, paints, gallery images, and saved copies attached to it. This action cannot be undone."
            deleteAction={deleteRecipeAction}
          />
        </div>
      ) : null}
    </section>
  )
}
