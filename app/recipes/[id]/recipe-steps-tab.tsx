'use client'

import Image from 'next/image'
import StepPaintFields from './components/step-paint-fields'
import SubmitButton from '../../components/SubmitButton'
import { Paint, Recipe, RecipeStep, StepPaintLink } from './components/types'

type Props = {
  isOwner: boolean
  recipe: Recipe
  steps: RecipeStep[]
  paintsByStepId: Map<string, StepPaintLink[]>
  filteredPaints: Paint[]
  activeStepIndex: number
  setActiveStepIndex: (value: number | ((current: number) => number)) => void
  deleteConfirmStepId: string | null
  setDeleteConfirmStepId: (value: string | null) => void
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
}

export default function RecipeStepsTab({
  recipe,
  steps = [],
  paintsByStepId,
  filteredPaints,
  activeStepIndex,
  setActiveStepIndex,
  deleteConfirmStepId,
  setDeleteConfirmStepId,
  moveRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
}: Props) {
  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-400">
        No steps yet. Add the first step below.
      </div>
    )
  }

  const selectedIndex = Math.min(Math.max(activeStepIndex, 0), steps.length - 1)
  const selectedStep = steps[selectedIndex]
  const selectedStepPaints = paintsByStepId.get(selectedStep.id) || []
  const stepImageUrl =
    typeof selectedStep.image_url === 'string' ? selectedStep.image_url.trim() : ''
  const hasStepImage =
    stepImageUrl.startsWith('http://') || stepImageUrl.startsWith('https://')
  const isConfirmingDelete = deleteConfirmStepId === selectedStep.id

  function selectStep(stepId: string) {
    const nextIndex = steps.findIndex((step) => step.id === stepId)
    if (nextIndex < 0) return

    setActiveStepIndex(nextIndex)
    setDeleteConfirmStepId(null)
  }

  const selectedStepFormId = `edit-recipe-step-${selectedStep.id}`

  return (
    <section className="rounded-2xl border border-white/10 bg-black p-4">
      <div className="mb-4">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          Edit Step
        </p>

        <label className="mb-1 block text-sm text-neutral-300">
          Choose Step
        </label>
        <select
          value={selectedStep.id}
          onChange={(event) => selectStep(event.target.value)}
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-white"
        >
          {steps.map((step) => (
            <option key={step.id} value={step.id}>
              Step {step.step_number}: {step.title}
            </option>
          ))}
        </select>
      </div>

      {isConfirmingDelete ? (
        <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-100">
            Delete step {selectedStep.step_number}?
          </p>
          <p className="mt-1 text-xs text-red-200/70">
            This will remove the step and resequence the remaining steps.
          </p>

          <div className="mt-3 flex gap-2">
            <form action={deleteRecipeStepAction}>
              <input type="hidden" name="recipeId" value={recipe.id} />
              <input type="hidden" name="stepId" value={selectedStep.id} />
              <SubmitButton
                idleText="Delete"
                pendingText="Deleting..."
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              />
            </form>

            <button
              type="button"
              onClick={() => setDeleteConfirmStepId(null)}
              className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-sm text-white transition hover:bg-neutral-900 active:scale-[0.98] active:opacity-70"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <form
        key={selectedStep.id}
        id={selectedStepFormId}
        action={async (formData) => {
          await updateRecipeStepAction(formData)
          setDeleteConfirmStepId(null)
        }}
        encType="multipart/form-data"
        className="space-y-4"
      >
        <input type="hidden" name="recipeId" value={recipe.id} />
        <input type="hidden" name="stepId" value={selectedStep.id} />

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Step Title
          </label>
          <input
            name="title"
            type="text"
            required
            defaultValue={selectedStep.title}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Instructions
          </label>
          <textarea
            name="instructions"
            rows={5}
            defaultValue={selectedStep.instructions || ''}
            placeholder="Optional instructions for this step"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Step Image
          </label>

          {hasStepImage ? (
            <Image
              src={stepImageUrl}
              alt={selectedStep.title}
              width={520}
              height={180}
              sizes="(max-width: 768px) 100vw, 520px"
              className="mb-3 h-36 w-full rounded-xl object-cover"
            />
          ) : null}

          <input
            type="file"
            name="step_image"
            accept="image/*"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
          />
        </div>

        <StepPaintFields
          key={selectedStep.id}
          paints={filteredPaints}
          existingPaints={selectedStepPaints}
          keyPrefix={selectedStep.id}
        />

        <div className="flex gap-2 border-t border-white/10 pt-4">
          <button
            type="submit"
            formAction={moveRecipeStepAction}
            name="direction"
            value="up"
            disabled={selectedStep.step_number === 1}
            className="tap-press tap-target inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-black px-4 py-3 text-sm text-white transition hover:bg-white/5 active:scale-[0.98] active:opacity-70 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
          >
            Move Up
          </button>

          <button
            type="submit"
            formAction={moveRecipeStepAction}
            name="direction"
            value="down"
            disabled={selectedStep.step_number === steps.length}
            className="tap-press tap-target inline-flex items-center justify-center rounded-xl border border-neutral-700 bg-black px-4 py-3 text-sm text-white transition hover:bg-white/5 active:scale-[0.98] active:opacity-70 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-neutral-700 disabled:text-white/60 disabled:opacity-70"
          >
            Move Down
          </button>
        </div>

        <div className="flex gap-2 border-t border-white/10 pt-4">
          <SubmitButton
            idleText="Save Step"
            pendingText="Saving step..."
            className="rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black"
          />

          <button
            type="reset"
            onClick={() => {
              setDeleteConfirmStepId(null)
            }}
            className="rounded-xl border border-neutral-700 px-4 py-3 text-white transition hover:bg-white/5 active:scale-[0.98] active:opacity-70"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => setDeleteConfirmStepId(selectedStep.id)}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 transition hover:bg-red-500/20 active:scale-[0.98] active:opacity-70"
          >
            Delete Step
          </button>
        </div>
      </form>
    </section>
  )
}
