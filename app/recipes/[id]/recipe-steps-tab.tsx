'use client'

import RecipeStepCard from './components/recipe-step-card'
import { Paint, Recipe, RecipeStep, StepPaintLink } from './components/types'

type Props = {
  isOwner: boolean
  recipe: Recipe
  steps: RecipeStep[]
  paintsByStepId: Map<string, StepPaintLink[]>
  filteredPaints: Paint[]
  activeStepIndex: number
  setActiveStepIndex: (value: number | ((current: number) => number)) => void
  editingStepId: string | null
  setEditingStepId: (value: string | null) => void
  deleteConfirmStepId: string | null
  setDeleteConfirmStepId: (value: string | null) => void
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
}

export default function RecipeStepsTab({
  isOwner,
  recipe,
  steps = [],
  paintsByStepId,
  filteredPaints,
  activeStepIndex,
  setActiveStepIndex,
  editingStepId,
  setEditingStepId,
  deleteConfirmStepId,
  setDeleteConfirmStepId,
  moveRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
}: Props) {
  return (
    <section className="mt-5">
      <h2 className="text-lg font-semibold text-white">Recipe Steps</h2>

      {(steps || []).length > 0 ? (
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition active:scale-[0.98] active:opacity-70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition active:scale-[0.98] active:opacity-70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
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
                    isOwner={isOwner}
                    recipe={recipe}
                    step={step}
                    stepsLength={steps.length}
                    stepIndex={index}
                    paintsForStep={paintsByStepId.get(step.id) || []}
                    filteredPaints={filteredPaints}
                    isEditingThisStep={isOwner && editingStepId === step.id}
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
                className={`h-1.5 rounded-full transition-all active:scale-[0.98] active:opacity-70 ${
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
    </section>
  )
}