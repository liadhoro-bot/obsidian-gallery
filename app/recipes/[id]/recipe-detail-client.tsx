'use client'

import { useEffect, useMemo, useState } from 'react'
import PaintPicker from './components/paint-picker'
import RecipeGallerySection from './components/recipe-gallery-section'
import RecipeHero from './components/recipe-hero'
import RecipeVideoCard from './recipe-video-card'
import RecipeInventoryCard from './components/recipe-inventory-card'
import RecipeStepCard from './components/recipe-step-card'
import {
  Paint,
  Recipe,
  RecipeImage,
  RecipeStep,
  StepPaintLink,
} from './components/types'

type Props = {
  recipe: Recipe
  steps: RecipeStep[]
  stepPaintLinks: StepPaintLink[]
  recipeImages: RecipeImage[]
  featuredImage: RecipeImage | null
  paints: Paint[]
  updateRecipeHeaderAction: (formData: FormData) => Promise<void>
  updateRecipeInventoryAction: (formData: FormData) => Promise<void>
  updateRecipeTipsAction: (formData: FormData) => Promise<void>
  createCustomPaintAction: (formData: FormData) => Promise<void>
  addRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  uploadRecipeImageAction: (formData: FormData) => Promise<void>
  setFeaturedRecipeImageAction: (formData: FormData) => Promise<void>
  deleteRecipeImageAction: (formData: FormData) => Promise<void>
  updateRecipePaintOwnershipAction: (formData: FormData) => Promise<void>
}

export default function RecipeDetailClient({
  recipe,
  steps,
  stepPaintLinks,
  recipeImages,
  featuredImage,
  paints,
  updateRecipeHeaderAction,
  updateRecipeInventoryAction,
  updateRecipeTipsAction,
  createCustomPaintAction,
  addRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
  moveRecipeStepAction,
  uploadRecipeImageAction,
  setFeaturedRecipeImageAction,
  deleteRecipeImageAction,
  updateRecipePaintOwnershipAction,
}: Props) {
  
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [isEditingInventory, setIsEditingInventory] = useState(false)
  const [isAddingStep, setIsAddingStep] = useState(false)
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [isAddingCustomPaint, setIsAddingCustomPaint] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [deleteConfirmStepId, setDeleteConfirmStepId] = useState<string | null>(
    null
  )
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(
    null
  )

  const [paintSearch, setPaintSearch] = useState('')
  const [paintBrand, setPaintBrand] = useState('all')
  const [paintLine, setPaintLine] = useState('all')
  const [paintOwnership, setPaintOwnership] = useState('all')

  const hasActivePaintFilters = Boolean(
    paintSearch.trim() ||
      paintBrand !== 'all' ||
      paintLine !== 'all' ||
      paintOwnership !== 'all'
  )

  const [isPaintFiltersOpen, setIsPaintFiltersOpen] =
    useState(hasActivePaintFilters)

  const availableBrands = useMemo(
    () =>
      Array.from(
        new Set(
          (paints || [])
            .map((paint) => paint.brand)
            .filter((brand): brand is string => Boolean(brand))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [paints]
  )

  const availableLines = useMemo(
    () =>
      Array.from(
        new Set(
          (paints || [])
            .filter((paint) => paintBrand === 'all' || paint.brand === paintBrand)
            .map((paint) => paint.line)
            .filter((line): line is string => Boolean(line))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [paints, paintBrand]
  )

  useEffect(() => {
    if (paintLine === 'all') return

    const stillValid = availableLines.includes(paintLine)
    if (!stillValid) {
      setPaintLine('all')
    }
  }, [paintBrand, paintLine, availableLines])

  useEffect(() => {
    if (hasActivePaintFilters) {
      setIsPaintFiltersOpen(true)
    }
  }, [hasActivePaintFilters])

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
        featuredImage={featuredImage}
        isEditingHeader={isEditingHeader}
        setIsEditingHeader={setIsEditingHeader}
        updateRecipeHeaderAction={updateRecipeHeaderAction}
      />

      <div className="space-y-5">
        <section>
          <h2 className="text-lg font-semibold text-white">Steps</h2>

          <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <button
                type="button"
                onClick={() => setIsPaintFiltersOpen((prev) => !prev)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-white">Paint Filters</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    Narrow the paint list used in the step paint dropdowns.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">
                    {hasActivePaintFilters ? 'Active filters' : 'Show filters'}
                  </span>
                  <span className="rounded-lg border border-neutral-700 bg-black px-3 py-2 text-xs text-white">
                    {isPaintFiltersOpen ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsAddingCustomPaint((prev) => !prev)}
                className="rounded-lg border border-cyan-500 px-3 py-2 text-xs text-cyan-400 transition hover:bg-cyan-500/10"
              >
                {isAddingCustomPaint ? 'Close' : '+ Add Paint'}
              </button>
            </div>

            {isPaintFiltersOpen ? (
              <div className="mt-4 border-t border-neutral-800 pt-4">
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPaintSearch('')
                      setPaintBrand('all')
                      setPaintLine('all')
                      setPaintOwnership('all')
                    }}
                    className="rounded-lg border border-neutral-700 bg-black px-3 py-2 text-xs text-white transition hover:bg-neutral-800"
                  >
                    Reset
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Search
                    </label>
                    <input
                      type="text"
                      value={paintSearch}
                      onChange={(e) => setPaintSearch(e.target.value)}
                      placeholder="Search by name or SKU"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Brand
                    </label>
                    <select
                      value={paintBrand}
                      onChange={(e) => {
                        setPaintBrand(e.target.value)
                        setPaintLine('all')
                      }}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="all">All brands</option>
                      {availableBrands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Line
                    </label>
                    <select
                      value={paintLine}
                      onChange={(e) => setPaintLine(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="all">All lines</option>
                      {availableLines.map((line) => (
                        <option key={line} value={line}>
                          {line}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Ownership
                    </label>
                    <select
                      value={paintOwnership}
                      onChange={(e) => setPaintOwnership(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                    >
                      <option value="all">All</option>
                      <option value="owned">Owned</option>
                      <option value="not_owned">Not owned</option>
                    </select>
                  </div>
                </div>

                <p className="mt-3 text-xs text-neutral-400">
                  Showing {filteredPaints.length} paints
                </p>
              </div>
            ) : null}

            {isAddingCustomPaint ? (
              <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <form
                  action={createCustomPaintAction}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <input type="hidden" name="recipeId" value={recipe.id} />

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm text-neutral-300">
                      Name
                    </label>
                    <input
                      name="name"
                      type="text"
                      required
                      placeholder="For example: Necro Violet"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Brand
                    </label>
                    <input
                      name="manufacturer"
                      type="text"
                      placeholder="Scale75"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Line
                    </label>
                    <input
                      name="series"
                      type="text"
                      placeholder="Layer Paint"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Paint Type
                    </label>
                    <input
                      name="paintType"
                      type="text"
                      placeholder="Acrylic"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Color Hex
                    </label>
                    <input
                      name="colorHex"
                      type="text"
                      placeholder="#7a5ca8"
                      className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
                    >
                      Save Paint
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddingCustomPaint(false)}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white transition hover:bg-neutral-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          {steps.length > 0 ? (
  <div className="mt-4">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-neutral-400">
        Step {activeStepIndex + 1} of {steps.length}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setActiveStepIndex((current) => Math.max(current - 1, 0))
          }
          disabled={activeStepIndex === 0}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10 disabled:opacity-30"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveStepIndex((current) =>
              Math.min(current + 1, steps.length - 1)
            )
          }
          disabled={activeStepIndex === steps.length - 1}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>

    <div className="overflow-hidden">
      <div
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transform: `translateX(-${activeStepIndex * 100}%)`,
        }}
      >
        {steps.map((step, index) => (
          <div
  key={step.id}
  className={`min-w-full max-w-full shrink-0 px-0.5 transition-all duration-500 ease-out ${
    index === activeStepIndex
      ? 'scale-100 opacity-100 blur-0'
      : 'scale-[0.96] opacity-40 blur-[1px]'
  }`}
>
            <RecipeStepCard
  key={`${step.id}-${activeStepIndex}`}
  recipe={recipe}
  step={step}
              stepsLength={steps.length}
              stepIndex={index}
              paintsForStep={paintsByStepId.get(step.id) || []}
              filteredPaints={filteredPaints}
              isEditingThisStep={editingStepId === step.id}
              deleteConfirmStepId={deleteConfirmStepId}
              setEditingStepId={setEditingStepId}
              setDeleteConfirmStepId={setDeleteConfirmStepId}
              moveRecipeStepAction={moveRecipeStepAction}
              updateRecipeStepAction={updateRecipeStepAction}
              deleteRecipeStepAction={deleteRecipeStepAction}
            />
          </div>
        ))}
      </div>
    </div>

    <div className="mt-4 flex justify-center gap-1.5">
      {steps.map((step, index) => (
        <button
          key={step.id}
          type="button"
          onClick={() => setActiveStepIndex(index)}
          className={`h-1.5 rounded-full transition-all ${
            index === activeStepIndex
              ? 'w-6 bg-cyan-400'
              : 'w-1.5 bg-white/20'
          }`}
        />
      ))}
    </div>
  </div>
) : (
  <p className="mt-4 text-neutral-400">No steps yet.</p>
)}


          <div className="mt-6">
            {!isAddingStep ? (
              <button
                type="button"
                onClick={() => setIsAddingStep(true)}
                className="rounded-xl border border-cyan-500 px-4 py-2 font-medium text-cyan-400"
              >
                + Add Step
              </button>
            ) : (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <h3 className="text-lg font-semibold text-white">Add Step</h3>

                <form
  action={async (formData) => {
    await addRecipeStepAction(formData)
    setIsAddingStep(false)
  }}
  className="mt-4 space-y-4"
>
                  <input type="hidden" name="recipeId" value={recipe.id} />

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Step Title
                    </label>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="e.g. Weathered Wash"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-neutral-300">
                      Instructions
                    </label>
                    <textarea
  name="instructions"
  rows={4}
  placeholder="Optional instructions for this step"
  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
/>
                  </div>

                  {[1, 2, 3].map((num) => (
                    <div
                      key={num}
                      className="rounded-xl border border-neutral-800 bg-black p-4"
                    >
                      <p className="text-sm font-medium text-white">
                        Paint {num}
                      </p>

                      <div className="mt-3 space-y-3">
                        <PaintPicker
                          key={`add-step-paint-${num}`}
                          name={`paintId${num}`}
                          paints={filteredPaints}
                        />

                        <input
                          name={`ratio${num}`}
                          type="text"
                          placeholder="Optional ratio"
                          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                    >
                      Add Step
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAddingStep(false)}
                      className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
<RecipeInventoryCard
  recipe={recipe}
  stepPaintLinks={stepPaintLinks}
  isEditingInventory={isEditingInventory}
  setIsEditingInventory={setIsEditingInventory}
  updateRecipeInventoryAction={updateRecipeInventoryAction}
  updateRecipePaintOwnershipAction={updateRecipePaintOwnershipAction}
/>
<div className="mt-6">
  <RecipeVideoCard
    recipeId={recipe.id}
    youtubeUrl={recipe.youtube_url}
  />
</div>

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
    </div>
  )
}