'use client'

import PaintPicker from './paint-picker'
import { Paint, Recipe, RecipeStep, StepPaintLink } from './types'
import PaintSwatch from './paint-swatch'

function getPaintSelectValue(
  paint: StepPaintLink['paint'] | null,
  paints: Paint[]
) {
  if (!paint) return ''

  const matchedPaint = paints.find((p) => p.id === paint.id)
  if (!matchedPaint) return ''

  return `${matchedPaint.source}:${matchedPaint.id}`
}
function getContrastTextColor(hex?: string | null) {
  if (!hex) return '#000'

  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)

  // perceived brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  return brightness > 150 ? '#000' : '#fff'
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
  const paint1 = paintsForStep[0]?.paint || null
  const paint2 = paintsForStep[1]?.paint || null
  const paint3 = paintsForStep[2]?.paint || null

return (
  <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[#081116] p-5 shadow-xl shadow-black/30">
    <div>
      
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
  {/* HEADER */}
  <div className="mb-8 flex items-start gap-4">
    <div
  key={step.step_number}
  className="text-5xl font-black leading-none text-neutral-500/40 animate-[stepNumberIn_500ms_cubic-bezier(0.22,1,0.36,1)]"
>
  {String(step.step_number).padStart(2, '0')}
</div>

    <h3 className="pt-1 text-2xl font-bold leading-tight text-white">
      {step.title}
    </h3>
  </div>

{/* SWATCHES */}
{paintsForStep.length > 0 && (
  <div className="mb-10 flex justify-center gap-5">
    {paintsForStep.slice(0, 3).map((link) => {
      const paint = link.paint
      if (!paint) return null

      const ratio = parseInt(link.ratio_text || '1', 10) || 1

      return (
        <div key={link.id} className="relative">
        <div className="h-32 w-32 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-inner">
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

          <div className="absolute bottom-1 right-1 flex flex-col items-end gap-1">
  <div className="flex items-center justify-end gap-1">
  {Array.from({ length: ratio }).map((_, i) => (
    <span
      key={i}
      className="block h-4 w-4 rotate-[225deg] rounded-full rounded-br-none border border-white/30"
      style={{
        backgroundColor: paint.hex_approx || '#888888',
        boxShadow:
          '0 0 0 1px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)',
      }}
    />
  ))}
</div>

  <span
    className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-black shadow"
    style={{
      backgroundColor: paint.hex_approx || '#888888',
      color: getContrastTextColor(paint.hex_approx),
      boxShadow:
        '0 0 0 2px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.55)',
    }}
  >
    {ratio} part{ratio === 1 ? '' : 's'}
  </span>
</div>
        </div>
      )
    })}
  </div>
)}

  {/* SUBTITLE */}
  <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
    {paintsForStep.length > 1
      ? 'PAINT MIX'
      : paintsForStep[0]?.paint?.brand || 'Paint'}
  </p>

  {/* PAINT TITLE */}
  <p className="mt-2 text-lg font-bold text-white">
    {paintsForStep
      .map((p) => {
        const paint = p.paint
        if (!paint) return ''
        return [paint.brand, paint.name].filter(Boolean).join(' ')
      })
      .join(' + ')}
  </p>

  {/* DESCRIPTION */}
  {step.instructions?.trim() && (
    <p className="mt-4 text-sm leading-7 text-neutral-300">
      {step.instructions}
    </p>
  )}
  <div className="mt-6 flex justify-end">
  {!isEditingThisStep ? (
    <button
      type="button"
      onClick={() =>
        setEditingStepId(isEditingThisStep ? null : step.id)
      }
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10"
      title="Edit step"
    >
      ✎
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <form action={moveRecipeStepAction}>
        <input type="hidden" name="recipeId" value={recipe.id} />
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          disabled={step.step_number === 1}
          className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white disabled:opacity-30"
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
        >
          ↓
        </button>
      </form>

      <button
        type="button"
        onClick={() =>
          setDeleteConfirmStepId(
            deleteConfirmStepId === step.id ? null : step.id
          )
        }
        className="rounded-full border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
      >
        X
      </button>
    </div>
  )}
</div>
</>
        )}
      </div>
    </div>
  )
}