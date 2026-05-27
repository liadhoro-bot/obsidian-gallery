'use client'

import PaintPicker from './paint-picker'
import { Paint, Recipe, RecipeStep, StepPaintLink } from './types'
import SubmitButton from '../../../components/SubmitButton'

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
  if (!hex) return '#fff'

  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return '#fff'

  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)

  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  return brightness > 150 ? '#05070a' : '#fff'
}

function getPaintColor(paint: StepPaintLink['paint'] | null) {
  return paint?.hex_approx || '#555555'
}

function DropletIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5c-.35 0-.68.16-.9.43C9.55 4.83 5.25 10.28 5.25 14.1A6.75 6.75 0 0 0 18.75 14.1c0-3.82-4.3-9.27-5.85-11.17A1.16 1.16 0 0 0 12 2.5Zm0 16.25a4.65 4.65 0 0 1-4.65-4.65c0-.41.34-.75.75-.75s.75.34.75.75A3.15 3.15 0 0 0 12 17.25c.41 0 .75.34.75.75s-.34.75-.75.75Z" />
    </svg>
  )
}

function PaintSwatch({
  link,
  large = false,
}: {
  link: StepPaintLink
  large?: boolean
  showName?: boolean
}) {
  const paint = link.paint
  if (!paint) return null

  const ratio = parseInt(link.ratio_text || '1', 10) || 1

  return (
    <div key={link.id} className="relative shrink-0">
      <div
        className={
          large
            ? 'aspect-square w-full overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-inner'
            : 'h-20 w-20 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 shadow-inner'
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
}

export default function RecipeStepCard({
  isOwner,
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
  isOwner: boolean
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

  const stepImageUrl =
    typeof step.image_url === 'string' ? step.image_url.trim() : ''

  const hasStepImage =
    stepImageUrl.startsWith('http://') || stepImageUrl.startsWith('https://')

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#081116] shadow-2xl shadow-black/40">
      <div className={hasStepImage ? '' : 'p-5'}>
        {isOwner && deleteConfirmStepId === step.id ? (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm font-semibold text-red-100">
              Delete this step?
            </p>

            <p className="mt-1 text-xs text-red-200/70">
              This will remove the step and resequence the remaining steps.
            </p>

            <div className="mt-3 flex gap-2">
              <form action={deleteRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />

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

        {isOwner && isEditingThisStep ? (
          <div className="space-y-4 rounded-2xl border border-neutral-800 bg-black p-4">
            <form
              action={async (formData) => {
                await updateRecipeStepAction(formData)
                setEditingStepId(null)
                setDeleteConfirmStepId(null)
              }}
              encType="multipart/form-data"
              className="space-y-4"
            >
              <input type="hidden" name="recipeId" value={recipe.id} />
              <input type="hidden" name="stepId" value={step.id} />

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    Edit Step
                  </p>

                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Step {step.step_number}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirmStepId(
                      deleteConfirmStepId === step.id ? null : step.id
                    )
                  }
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/20 active:scale-[0.98] active:opacity-70"
                >
                  Delete Step
                </button>
              </div>

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

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Step Image
                </label>

                {hasStepImage ? (
                  <img
                    src={stepImageUrl}
                    alt={step.title}
                    className="mb-3 h-32 w-full rounded-xl object-cover"
                  />
                ) : null}

                <input
                  type="file"
                  name="step_image"
                  accept="image/*"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:text-sm file:font-bold file:text-black"
                />
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-sm font-medium text-white">Paint 1</p>

                <div className="mt-3 space-y-3">
                  <PaintPicker
                    key={`${step.id}-paint1-${getPaintSelectValue(
                      paint1,
                      filteredPaints
                    )}`}
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
                    key={`${step.id}-paint2-${getPaintSelectValue(
                      paint2,
                      filteredPaints
                    )}`}
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
                    key={`${step.id}-paint3-${getPaintSelectValue(
                      paint3,
                      filteredPaints
                    )}`}
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
                <SubmitButton
                  idleText="Save Step"
                  pendingText="Saving step..."
                  className="rounded-xl bg-cyan-400 px-4 py-2 font-bold text-black"
                />

                <button
                  type="button"
                  onClick={() => {
                    setEditingStepId(null)
                    setDeleteConfirmStepId(null)
                  }}
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-white transition hover:bg-white/5 active:scale-[0.98] active:opacity-70"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className="flex gap-2 border-t border-white/10 pt-4">
              <form action={moveRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="direction" value="up" />

                <SubmitButton
                  idleText="Move Up"
                  pendingText="Moving..."
                  disabled={step.step_number === 1}
                  className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
                />
              </form>

              <form action={moveRecipeStepAction}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="direction" value="down" />

                <SubmitButton
                  idleText="Move Down"
                  pendingText="Moving..."
                  disabled={step.step_number === stepsLength}
                  className="rounded-xl border border-neutral-700 bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
                />
              </form>
            </div>
          </div>
        ) : (
          <>
            {hasStepImage ? (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-b-[2rem]">
                  <img
                    src={stepImageUrl}
                    alt={step.title}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#081116] via-[#081116]/35 to-transparent" />
                </div>

                <div className="px-5 pb-5 pt-6">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                    Step {String(step.step_number).padStart(2, '0')} /{' '}
                    {String(stepsLength).padStart(2, '0')}
                  </p>

                  <h2 className="mt-3 text-4xl font-black leading-none tracking-tight text-white">
                    {step.title}
                  </h2>

                  {paintsForStep.length > 0 ? (
                    <div className="mt-8">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-neutral-500">
                        The Palette
                      </p>

                      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                        {paintsForStep.slice(0, 3).map((link) => (
                          <PaintSwatch key={link.id} link={link} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {step.instructions?.trim() ? (
                    <div className="mt-8 rounded-3xl border border-white/5 bg-white/[0.03] p-6 text-lg leading-9 text-neutral-300 backdrop-blur-sm">
                      {step.instructions}
                    </div>
                  ) : null}

                  {isOwner ? (
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingStepId(step.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10 active:scale-[0.98] active:opacity-70"
                        title="Edit step"
                      >
                        ✎
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                {paintsForStep.length > 0 ? (
                  <div className="mb-8 grid grid-cols-3 gap-3">
                    {paintsForStep.slice(0, 3).map((link) => (
                      <PaintSwatch
                        key={link.id}
                        link={link}
                        large
                        showName
                      />
                    ))}
                  </div>
                ) : null}

                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Step {String(step.step_number).padStart(2, '0')} /{' '}
                  {String(stepsLength).padStart(2, '0')}
                </p>

                <h2 className="mt-3 text-4xl font-black leading-none tracking-tight text-white">
                  {step.title}
                </h2>

                {step.instructions?.trim() ? (
                  <div className="mt-8 rounded-3xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-sm">
                    <div className="text-lg leading-9 text-neutral-300">
                      {step.instructions}
                    </div>

                    {paintsForStep.length > 0 ? (
                      <div className="mt-8 flex flex-wrap gap-3">
                        {paintsForStep.slice(0, 3).map((link) => {
                          const paint = link.paint
                          if (!paint) return null

                          return (
                            <div
                              key={link.id}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase text-neutral-200"
                            >
                              {link.ratio_text ? `${link.ratio_text} · ` : ''}
                              {paint.name}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isOwner ? (
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setEditingStepId(step.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur transition hover:bg-white/10 active:scale-[0.98] active:opacity-70"
                      title="Edit step"
                    >
                      ✎
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}