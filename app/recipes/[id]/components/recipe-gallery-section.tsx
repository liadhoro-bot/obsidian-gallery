'use client'

import { Recipe, RecipeImage } from './types'

export default function RecipeGallerySection({
  recipe,
  recipeImages,
  isAddingImage,
  setIsAddingImage,
  deleteConfirmImageId,
  setDeleteConfirmImageId,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
}: {
  recipe: Recipe
  recipeImages: RecipeImage[]
  isAddingImage: boolean
  setIsAddingImage: (value: boolean) => void
  deleteConfirmImageId: string | null
  setDeleteConfirmImageId: (value: string | null) => void
  uploadRecipeImageAction: (formData: FormData) => Promise<void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Gallery</h2>

        <button
          type="button"
          onClick={() => setIsAddingImage(!isAddingImage)}
          className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
          title="Add image"
        >
          +
        </button>
      </div>

      {isAddingImage ? (
        <div className="mt-4 rounded-2xl border border-neutral-800 bg-black p-4">
          <form action={uploadRecipeImageAction} className="space-y-4">
            <input type="hidden" name="recipeId" value={recipe.id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Upload Image
              </label>
              <input
                name="image"
                type="file"
                accept="image/*"
                required
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:font-medium file:text-black"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Alt Text (optional)
              </label>
              <input
                name="altText"
                type="text"
                placeholder="e.g. Finished armor highlight reference"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
              >
                Upload Image
              </button>

              <button
                type="button"
                onClick={() => setIsAddingImage(false)}
                className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {recipeImages.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {recipeImages.map((image) => (
            <div
              key={image.id}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-black"
            >
              <img
                src={image.image_url}
                alt={image.alt_text || recipe.name}
                className="h-40 w-full object-cover"
              />

              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  {image.is_featured ? (
                    <span className="inline-block rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-400">
                      Featured
                    </span>
                  ) : (
                    <form action={setFeaturedRecipeImageAction}>
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                        title="Set as featured"
                      >
                        ★
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirmImageId(
                        deleteConfirmImageId === image.id ? null : image.id
                      )
                    }
                    className="rounded-full border border-neutral-700 bg-black px-2 py-1 text-xs text-white"
                    title="Delete image"
                  >
                    X
                  </button>
                </div>

                {deleteConfirmImageId === image.id ? (
                  <div className="rounded-xl border border-neutral-700 bg-black p-3">
                    <p className="text-sm text-white">Delete this image?</p>

                    <div className="mt-3 flex gap-2">
                      <form action={deleteRecipeImageAction}>
                        <input type="hidden" name="recipeId" value={recipe.id} />
                        <input type="hidden" name="imageId" value={image.id} />
                        <button
                          type="submit"
                          className="rounded-xl border border-neutral-700 bg-white px-3 py-2 text-sm font-medium text-black"
                        >
                          Delete
                        </button>
                      </form>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmImageId(null)}
                        className="rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {image.alt_text ? (
                  <p className="text-xs text-neutral-500">{image.alt_text}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">No recipe images yet.</p>
      )}
    </section>
  )
}