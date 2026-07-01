'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import RecipeHero from './components/recipe-hero'
import {
  Paint,
  Recipe,
  RecipeImage,
  RecipeStep,
  StepPaintLink,
} from './components/types'
import RecipeDetailTabs, { RecipeDetailTab } from './recipe-detail-tabs'
import RecipeDetailsTab from './recipe-details-tab'
import RecipeAddStepTab from './recipe-add-step-tab'
import RecipeGuideDialog from './recipe-guide-dialog'
import RecipeStepsTab from './recipe-steps-tab'
import type { GalleryUploadResult } from '../../../utils/images/gallery-upload'

type Props = {
  recipe: Recipe
  isOwner: boolean
  steps: RecipeStep[]
  stepPaintLinks: StepPaintLink[]
  recipeImages: RecipeImage[]
  featuredImage: RecipeImage | null
  paints: Paint[]
  updateRecipeHeaderAction: (formData: FormData) => Promise<void>
  updateRecipeInventoryAction: (formData: FormData) => Promise<void>
  updateRecipeTipsAction: (formData: FormData) => Promise<void>
  addRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  uploadRecipeImageAction: (formData: FormData) => Promise<GalleryUploadResult | void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
  updateRecipePaintOwnershipAction: (formData: FormData) => Promise<void>
  deleteRecipeAction: (formData: FormData) => Promise<void>
  actionRow?: ReactNode
}

export default function RecipeDetailClient({
  recipe,
  isOwner,
  steps,
  stepPaintLinks,
  recipeImages,
  featuredImage,
  paints,
  updateRecipeHeaderAction,
  updateRecipeInventoryAction,
  addRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
  moveRecipeStepAction,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
  updateRecipePaintOwnershipAction,
  deleteRecipeAction,
  actionRow,
}: Props) {
  const [activeTab, setActiveTab] = useState<RecipeDetailTab>('details')
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isEditingInventory, setIsEditingInventory] = useState(false)
  const [isRecipeGuideOpen, setIsRecipeGuideOpen] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [deleteConfirmStepId, setDeleteConfirmStepId] = useState<string | null>(null)

  const [paintSearch, setPaintSearch] = useState('')
  const [paintBrand, setPaintBrand] = useState('all')
  const [paintLine, setPaintLine] = useState('all')
  const [paintOwnership, setPaintOwnership] = useState('all')

  const filteredPaints = useMemo(() => {
    return (paints || []).filter((paint) => {
      const search = paintSearch.trim().toLowerCase()

      const matchesSearch =
        !search ||
        (paint.name || '').toLowerCase().includes(search) ||
        (paint.sku || '').toLowerCase().includes(search)

      const matchesBrand = paintBrand === 'all' || paint.brand === paintBrand
      const matchesLine = paintLine === 'all' || paint.line === paintLine

      const matchesOwnership =
        paintOwnership === 'all' ||
        (paintOwnership === 'owned' && paint.is_owned) ||
        (paintOwnership === 'not_owned' && !paint.is_owned)

      return matchesSearch && matchesBrand && matchesLine && matchesOwnership
    })
  }, [paints, paintSearch, paintBrand, paintLine, paintOwnership])

  const paintsByStepId = useMemo(() => {
    const map = new Map<string, StepPaintLink[]>()

    for (const link of stepPaintLinks) {
      const existing = map.get(link.recipe_step_id) || []
      existing.push(link)
      map.set(link.recipe_step_id, existing)
    }

    return map
  }, [stepPaintLinks])

  return (
    <div className="w-full">
      <RecipeHero
  recipe={recipe}
  isOwner={isOwner}
  featuredImage={featuredImage}
  isEditingHeader={isOwner && isEditingHeader}
  setIsEditingHeader={setIsEditingHeader}
  updateRecipeHeaderAction={updateRecipeHeaderAction}
  deleteRecipeAction={deleteRecipeAction}
/>

      {actionRow}

      <RecipeDetailTabs
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  isOwner={isOwner}
  onRecipeStepsClick={() => setIsRecipeGuideOpen(true)}
/>

      <RecipeGuideDialog
        isOpen={isRecipeGuideOpen}
        onClose={() => setIsRecipeGuideOpen(false)}
        recipe={recipe}
        steps={steps}
        featuredImage={featuredImage}
        paintsByStepId={paintsByStepId}
        stepPaintLinks={stepPaintLinks}
      />

      {activeTab === 'details' ? (
        <RecipeDetailsTab
          isOwner={isOwner}
          recipe={recipe}
          stepPaintLinks={stepPaintLinks}
          recipeImages={recipeImages}
          isEditingInventory={isEditingInventory}
          setIsEditingInventory={setIsEditingInventory}
          updateRecipeInventoryAction={updateRecipeInventoryAction}
          updateRecipePaintOwnershipAction={updateRecipePaintOwnershipAction}
          uploadRecipeImageAction={uploadRecipeImageAction}
          setFeaturedRecipeImageAction={setFeaturedRecipeImageAction}
          deleteRecipeImageAction={deleteRecipeImageAction}
        />
      ) : null}

      {isOwner && activeTab === 'edit' ? (
        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                Edit Recipe
              </p>
              <h2 className="mt-1 text-xl font-semibold">Recipe Steps</h2>
            </div>

            <RecipeStepsTab
              isOwner={isOwner}
              recipe={recipe}
              steps={steps}
              paintsByStepId={paintsByStepId}
              filteredPaints={filteredPaints}
              activeStepIndex={activeStepIndex}
              setActiveStepIndex={setActiveStepIndex}
              deleteConfirmStepId={deleteConfirmStepId}
              setDeleteConfirmStepId={setDeleteConfirmStepId}
              moveRecipeStepAction={moveRecipeStepAction}
              updateRecipeStepAction={updateRecipeStepAction}
              deleteRecipeStepAction={deleteRecipeStepAction}
            />
          </section>

          <RecipeAddStepTab
            recipe={recipe}
            paints={paints}
            filteredPaints={filteredPaints}
            paintSearch={paintSearch}
            setPaintSearch={setPaintSearch}
            paintBrand={paintBrand}
            setPaintBrand={setPaintBrand}
            paintLine={paintLine}
            setPaintLine={setPaintLine}
            paintOwnership={paintOwnership}
            setPaintOwnership={setPaintOwnership}
            addRecipeStepAction={addRecipeStepAction}
          />
        </div>
      ) : null}
    </div>
  )
}
