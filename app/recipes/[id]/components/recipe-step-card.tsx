'use client'

import PaintSwatch from './paint-swatch'
import PaintPicker from './paint-picker'
import { Paint, Recipe, RecipeStep, StepPaintLink } from './types'

const STEP_COLORS = [
  '#22d3ee',
  '#f97316',
  '#facc15',
  '#a855f7',
  '#10b981',
  '#ef4444',
]

function getPaintSelectValue(
  paint: StepPaintLink['paint'] | null,
  paints: Paint[]
) {
  if (!paint) return ''

  const matchedPaint = paints.find((p) => p.id === paint.id)
  if (!matchedPaint) return ''

  return `${matchedPaint.source}:${matchedPaint.id}`
}

export default function RecipeStepCard({
  recipe,
  step,
  stepsLength,
  stepIndex,
  paintsForStep,
  filteredPaints,
  isEditingThisStep,
  deleteConfirmStepId,
  setEditingStepId,
  setDeleteConfirmStepId,
  moveRecipeStepAction,
  updateRecipeStepAction,
  deleteRecipeStepAction,
}: {
  recipe: Recipe
  step: RecipeStep
  stepsLength: number
  stepIndex: number
  paintsForStep: StepPaintLink[]
  filteredPaints: Paint[]
  isEditingThisStep: boolean
  deleteConfirmStepId: string | null
  setEditingStepId: (value: string | null) => void
  setDeleteConfirmStepId: (value: string | null) => void
  moveRecipeStepAction: (formData: FormData) => Promise<void>
  updateRecipeStepAction: (formData: FormData) => Promise<void>
  deleteRecipeStepAction: (formData: FormData) => Promise<void>
}) {
  const accent = STEP_COLORS[stepIndex % STEP_COLORS.length]

  const paint1 = paintsForStep[0]?.paint || null
  const paint2 = paintsForStep[1]?.paint || null
  const paint3 = paintsForStep[2]?.paint || null

  const ratioBadge = paintsForStep
    .map((link) => link.ratio_text)
    .filter(Boolean)
    .join(' : ')

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              Step {String(step.step_number).padStart(2, '0')}
            </p>

            <h3 className="mt-3 min-w-0 text-2xl font-semibold leading-tight text-white">
              {step.title}
            </h3>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex flex-col items-end gap-3">
              {paintsForStep.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {paintsForStep.map((link) => {
                    const paint = link.paint

                    return paint ? (
                      <div
                        key={link.id}
                        className="h-9 w-9 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800"
                        title={
                          [paint.brand, paint.line, paint.name]
                            .filter(Boolean)
                            .join(' • ') || 'Paint'
                        }
                      >
                        {paint.swatch_image_url ? (
                          <img
                            src={paint.swatch_image_url}
                            alt={paint.name || 'Paint'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{
                              backgroundColor: paint.hex_approx || '#888888',
                            }}
                          />
                        )}
                      </div>
                    ) : null
                  })}
                </div>
              ) : null}

              {ratioBadge ? (
                <div className="rounded-full border border-neutral-700 bg-black px-3 py-1.5 text-sm font-medium text-orange-400 shadow-sm">
                  {ratioBadge}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <form action={moveRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  type="submit"
                  disabled={step.step_number === 1}
                  className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-30"
                  title="Move step up"
                >
                  ↑
                </button>
              </form>

              <form action={moveRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={step.step_number === stepsLength}
                  className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-30"
                  title="Move step down"
                >
                  ↓
                </button>
              </form>

              <button
                type="button"
                onClick={() =>
                  setEditingStepId(isEditingThisStep ? null : step.id)
                }
                className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                title="Edit step"
              >
                ✎
              </button>

              <button
                type="button"
                onClick={() =>
                  setDeleteConfirmStepId(
                    deleteConfirmStepId === step.id ? null : step.id
                  )
                }
                className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
                title="Delete step"
              >
                X
              </button>
            </div>
          </div>
        </div>

        {deleteConfirmStepId === step.id ? (
          <div className="mt-4 rounded-2xl border border-neutral-700 bg-black p-4">
            <p className="text-sm text-white">Delete this step?</p>

            <div className="mt-3 flex gap-2">
              <form action={deleteRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />
                <button
                  type="submit"
                  className="rounded-xl border border-neutral-700 bg-white px-4 py-2 text-sm font-medium text-black"
                >
                  Delete
                </button>
              </form>

              <button
                type="button"
                onClick={() => setDeleteConfirmStepId(null)}
                className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {isEditingThisStep ? (
          <form
  action={async (formData) => {
    await updateRecipeStepAction(formData)
    setEditingStepId(null)
    setDeleteConfirmStepId(null)
  }}
  className="mt-4 space-y-4 rounded-2xl border border-neutral-800 bg-black p-4"
>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="stepId" value={step.id} />

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Step Title
              </label>
              <input
                name="title"
                type="text"
                required
                defaultValue={step.title}
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
  defaultValue={step.instructions || ''}
  placeholder="Optional instructions for this step"
  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
/>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-sm font-medium text-white">Paint 1</p>
              <div className="mt-3 space-y-3">
                <PaintPicker
                  key={`${step.id}-paint1-${getPaintSelectValue(paint1, filteredPaints)}`}
                  name="paintId1"
                  paints={filteredPaints}
                  defaultValue={getPaintSelectValue(paint1, filteredPaints)}
                />
                <input
                  name="ratio1"
                  type="text"
                  defaultValue={paintsForStep[0]?.ratio_text || ''}
                  placeholder="Optional ratio"
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-sm font-medium text-white">Paint 2</p>
              <div className="mt-3 space-y-3">
                <PaintPicker
                  key={`${step.id}-paint2-${getPaintSelectValue(paint2, filteredPaints)}`}
                  name="paintId2"
                  paints={filteredPaints}
                  defaultValue={getPaintSelectValue(paint2, filteredPaints)}
                />
                <input
                  name="ratio2"
                  type="text"
                  defaultValue={paintsForStep[1]?.ratio_text || ''}
                  placeholder="Optional ratio"
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-sm font-medium text-white">Paint 3</p>
              <div className="mt-3 space-y-3">
                <PaintPicker
                  key={`${step.id}-paint3-${getPaintSelectValue(paint3, filteredPaints)}`}
                  name="paintId3"
                  paints={filteredPaints}
                  defaultValue={getPaintSelectValue(paint3, filteredPaints)}
                />
                <input
                  name="ratio3"
                  type="text"
                  defaultValue={paintsForStep[2]?.ratio_text || ''}
                  placeholder="Optional ratio"
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
              >
                Save Step
              </button>

              <button
                type="button"
                onClick={() => setEditingStepId(null)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            {paintsForStep.length > 0 ? (
              <div className="mt-5 space-y-3">
                {paintsForStep.map((link) => {
                  const paint = link.paint
                  if (!paint) return null

                  return (
                    <div
                      key={link.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <PaintSwatch paint={paint} size="md" />

                      <div className="min-w-0">
                        <p className="font-medium text-white">{paint.name}</p>
                        <p className="text-xs text-neutral-500">
                          {[paint.brand, paint.line].filter(Boolean).join(' • ') ||
                            'Unknown brand'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {step.instructions?.trim() ? (
  <div className="mt-5 rounded-xl bg-black p-4">
    <p className="text-xs uppercase tracking-wide text-neutral-500">
      Instructions
    </p>
    <p className="mt-2 text-sm leading-6 text-neutral-300">
      {step.instructions}
    </p>
  </div>
) : null}
          </>
        )}
      </div>
    </div>
  )
}