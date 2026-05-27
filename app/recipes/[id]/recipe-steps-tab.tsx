'use client'

import { useRef } from 'react'
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
  const touchStartX = useRef<number | null>(null)

  function goPrevious() {
    setActiveStepIndex((current) => Math.max(current - 1, 0))
  }

  function goNext() {
    setActiveStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return

    const touchEndX = event.changedTouches[0]?.clientX ?? null
    if (touchEndX === null) return

    const diff = touchStartX.current - touchEndX

    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        goNext()
      } else {
        goPrevious()
      }
    }

    touchStartX.current = null
  }

  return (
    <section className="mt-5">
      {(steps || []).length > 0 ? (
        <div>
          <div
            className="overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
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

         <div className="mt-5 flex gap-3">
  <button
    type="button"
    onClick={goPrevious}
    disabled={activeStepIndex === 0}
    className="flex h-14 w-[28%] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-black/30 transition hover:bg-white/10 active:scale-[0.98] active:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
  >
    Previous
  </button>

  <button
    type="button"
    onClick={goNext}
    disabled={activeStepIndex === steps.length - 1}
    className="flex h-14 w-[72%] items-center justify-center rounded-xl bg-cyan-400 text-xs font-black uppercase tracking-[0.22em] text-black shadow-xl shadow-cyan-950/40 transition hover:bg-cyan-300 active:scale-[0.98] active:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
  >
    Next
  </button>
</div>
        </div>
      ) : (
        <p className="mt-4 text-neutral-400">No steps yet.</p>
      )}
    </section>
  )
}