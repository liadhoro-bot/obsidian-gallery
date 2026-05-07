'use client'

import { useState } from 'react'
import RecipeVideoCard from './recipe-video-card'
import RecipeInventoryCard from './components/recipe-inventory-card'
import RecipeGallerySection from './components/recipe-gallery-section'
import { Recipe, RecipeImage, StepPaintLink } from './components/types'

type Props = {
  recipe: Recipe
  stepPaintLinks: StepPaintLink[]
  recipeImages: RecipeImage[]
  isEditingInventory: boolean
  setIsEditingInventory: (value: boolean) => void
  updateRecipeInventoryAction: (formData: FormData) => Promise<void>
  updateRecipePaintOwnershipAction: (formData: FormData) => Promise<void>
  uploadRecipeImageAction: (formData: FormData) => Promise<void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
}

export default function RecipeDetailsTab({
  recipe,
  stepPaintLinks,
  recipeImages,
  isEditingInventory,
  setIsEditingInventory,
  updateRecipeInventoryAction,
  updateRecipePaintOwnershipAction,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
}: Props) {
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null)

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
          Description
        </p>

        <p className="mt-3 text-sm leading-6 text-white/65">
          {recipe.description || 'No description yet.'}
        </p>
      </section>

      <RecipeInventoryCard
        recipe={recipe}
        stepPaintLinks={stepPaintLinks}
        isEditingInventory={isEditingInventory}
        setIsEditingInventory={setIsEditingInventory}
        updateRecipeInventoryAction={updateRecipeInventoryAction}
        updateRecipePaintOwnershipAction={updateRecipePaintOwnershipAction}
      />

      <RecipeVideoCard recipeId={recipe.id} youtubeUrl={recipe.youtube_url} />

      <RecipeGallerySection
        recipe={recipe}
        recipeImages={recipeImages}
        isAddingImage={isAddingImage}
        setIsAddingImage={setIsAddingImage}
        deleteConfirmImageId={deleteConfirmImageId}
        setDeleteConfirmImageId={setDeleteConfirmImageId}
        uploadRecipeImageAction={uploadRecipeImageAction}
        setFeaturedRecipeImageAction={setFeaturedRecipeImageAction}
        deleteRecipeImageAction={deleteRecipeImageAction}
      />
    </div>
  )
}